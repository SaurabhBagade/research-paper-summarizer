import fitz  # PyMuPDF
import os
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_text(pdf_path, output_json_path):
    """
    Extracts text from a PDF and saves it to a JSON file.
    Output JSON structure: {page_number: text_content}
    """
    try:
        doc = fitz.open(pdf_path)
        text_data = {}
        for i, page in enumerate(doc):
            text_data[i + 1] = page.get_text()
        
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(text_data, f, indent=4)
        logger.info(f"Text extracted successfully to {output_json_path} ({len(text_data)} pages)")
        return text_data
    except Exception as e:
        logger.error(f"Error extracting text from {pdf_path}: {e}", exc_info=True)
        return None


def extract_text_blocks(pdf_path, output_json_path):
    """
    Extracts text blocks with bounding boxes per page using PyMuPDF.
    Saved alongside the regular text JSON and used by the embedding pipeline
    to store chunk coordinates in ChromaDB for exact section highlighting.

    Output structure:
    {
      "1": {
        "page_width": 612, "page_height": 792,
        "blocks": [{"text": "...", "bbox": [x0, y0, x1, y1]}, ...]
      }, ...
    }
    """
    try:
        doc = fitz.open(pdf_path)
        block_data = {}
        for i, page in enumerate(doc):
            page_blocks = []
            for block in page.get_text("blocks"):
                # block = (x0, y0, x1, y1, text, block_no, block_type)
                # block_type 0 = text, 1 = image — skip images
                if block[6] == 0:
                    text = block[4].strip()
                    if text:
                        page_blocks.append({
                            "text": text,
                            "bbox": [block[0], block[1], block[2], block[3]],
                        })
            block_data[str(i + 1)] = {
                "page_width": page.rect.width,
                "page_height": page.rect.height,
                "blocks": page_blocks,
            }

        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(block_data, f, indent=2)
        logger.info(f"Text blocks extracted to {output_json_path}")
        return block_data
    except Exception as e:
        logger.error(f"Error extracting text blocks from {pdf_path}: {e}", exc_info=True)
        return None


def extract_images(pdf_path, output_img_dir):
    """
    Extracts images from a PDF and saves them to the output directory.
    """
    try:
        if not os.path.exists(output_img_dir):
            os.makedirs(output_img_dir)
            
        doc = fitz.open(pdf_path)
        img_count = 0
        for i, page in enumerate(doc):
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                image_filename = f"page_{i+1}_img_{img_index+1}.{image_ext}"
                image_path = os.path.join(output_img_dir, image_filename)
                
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                img_count += 1
                
        logger.info(f"Extracted {img_count} images to {output_img_dir}")
        return img_count
    except Exception as e:
        logger.error(f"Error extracting images from {pdf_path}: {e}", exc_info=True)
        return 0


def extract_image_index(pdf_path, output_img_dir, index_json_path):
    """
    Extracts images from a PDF, finds each figure's caption (the nearest text block
    below the image on the same page), and saves an index JSON used by the embedding
    pipeline to make images retrievable by semantic similarity to questions.

    Output index structure:
    [
      {
        "filename": "page_3_img_1.png",
        "page": 3,
        "caption": "Figure 3: Comparison of model accuracy..."
      },
      ...
    ]ṭ
    Images without a detectable caption are still saved but excluded from the index.
    """
    try:
        if not os.path.exists(output_img_dir):
            os.makedirs(output_img_dir)

        doc = fitz.open(pdf_path)
        index = []

        for page_idx, page in enumerate(doc):
            page_num = page_idx + 1
            all_blocks = page.get_text("blocks")

            # Separate text blocks and image blocks
            # block = (x0, y0, x1, y1, text_or_name, block_no, block_type)
            text_blocks = [b for b in all_blocks if b[6] == 0 and b[4].strip()]
            image_list = page.get_images(full=True)

            for img_idx, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                img_width = base_image.get("width", 0)
                img_height = base_image.get("height", 0)
                colorspace = base_image.get("colorspace", 1)

                # ── Filter out junk images ──────────────────────────────────
                # 1. Skip mask/alpha images (colorspace=0 means no real colour data)
                if colorspace == 0:
                    continue
                # 2. Skip images that are too small to be real figures
                if img_width < 100 or img_height < 100:
                    continue
                # 3. Skip nearly-empty images (< 2 KB encoded = blank/white)
                if len(image_bytes) < 2048:
                    continue
                # ────────────────────────────────────────────────────────────

                filename = f"page_{page_num}_img_{img_idx + 1}.{image_ext}"
                image_path = os.path.join(output_img_dir, filename)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                # Find the image's approximate vertical position on the page
                # using its xref bounding box from the page's image blocks
                img_bbox = None
                for b in all_blocks:
                    if b[6] == 1:  # image block
                        img_bbox = (b[0], b[1], b[2], b[3])
                        break  # use first image block as approximate position

                if img_bbox is None:
                    continue

                img_bottom = img_bbox[3]  # y1 of image — caption appears below this

                # Find the closest text block BELOW the image (within 120pt)
                caption = None
                best_distance = float("inf")
                for tb in text_blocks:
                    tb_top = tb[1]   # y0 of text block
                    tb_text = tb[4].strip()
                    distance = tb_top - img_bottom
                    # Must be below the image and not too far — and look like a caption
                    if 0 < distance < 120 and distance < best_distance:
                        # Prefer blocks that start with "Fig" / "Figure" / "Table"
                        lower = tb_text.lower()
                        if any(lower.startswith(kw) for kw in ("fig", "figure", "table", "chart", "plot", "diagram", "illustration")):
                            caption = tb_text
                            best_distance = distance
                        elif best_distance == float("inf"):
                            # Accept any nearby text as fallback caption
                            caption = tb_text
                            best_distance = distance

                if caption:
                    index.append({
                        "filename": filename,
                        "page": page_num,
                        "caption": caption,
                    })
                    logger.debug(f"  [{filename}] caption: {caption[:60]}...")

        with open(index_json_path, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2)

        logger.info(f"Image index saved: {len(index)} captioned images → {index_json_path}")
        return index
    except Exception as e:
        logger.error(f"Error building image index from {pdf_path}: {e}", exc_info=True)
        return []


def extract_tables(pdf_path, output_dir):
    """
    Extracts tables from a PDF using pdfplumber and saves them as CSV files.
    """
    import pdfplumber
    import csv
    
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        total_tables = 0
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                for j, table in enumerate(tables):
                    if table:
                        table_filename = f"page_{i+1}_table_{j+1}.csv"
                        table_path = os.path.join(output_dir, table_filename)
                        
                        with open(table_path, "w", newline="", encoding="utf-8") as f:
                            writer = csv.writer(f)
                            writer.writerows(table)
                        total_tables += 1
                        
        logger.info(f"Extracted {total_tables} tables to {output_dir}")
        return total_tables
    except ImportError:
        logger.error("pdfplumber not installed. Please install it with: pip install pdfplumber")
        return 0
    except Exception as e:
        logger.error(f"Error extracting tables from {pdf_path}: {e}", exc_info=True)
        return 0

if __name__ == "__main__":
    # Test with a sample PDF if run directly
    import glob
    pdf_files = glob.glob("data_pdf/*.pdf")
    if pdf_files:
        test_pdf = pdf_files[0]
        logger.info(f"Testing with {test_pdf}")
        extract_text(test_pdf, "test_output.json")
        extract_images(test_pdf, "test_images")
        # extract_tables(test_pdf, "test_tables")
    else:
        logger.warning("No PDFs found in data_pdf/ to test.")
