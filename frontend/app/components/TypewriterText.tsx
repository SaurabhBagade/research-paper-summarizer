import { useState, useEffect } from 'react';

interface TypewriterTextProps {
    text: string;
    speed?: number;
    animate?: boolean;
}

export function TypewriterText({ text, speed = 15, animate = true }: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // If animation is disabled or we've finished typing, just render full text
        if (!animate) {
            setDisplayedText(text);
            return;
        }

        // Reset state if text changes
        if (currentIndex === 0 && displayedText === '') {
            // Start typing loop
        }

        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);

            // Randomize speed slightly for a more natural typing effect (Optional)
            // (Math.random() * (speed * 1.5 - speed / 2) + speed / 2)

            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text, speed, animate]);

    // Handle case where text completely changes
    useEffect(() => {
        if (animate) {
            setDisplayedText('');
            setCurrentIndex(0);
        } else {
            setDisplayedText(text);
        }
    }, [text, animate]);

    return <span className="whitespace-pre-wrap">{displayedText}</span>;
}
