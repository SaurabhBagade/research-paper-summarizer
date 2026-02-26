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
