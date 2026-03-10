import React, { useRef, useEffect } from 'react';
import ClipboardJS from 'clipboard';
import { Button } from './ui/button';

const CopyToClipboard = ({ listIngreds }: any) => {
    const textToCopyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clipboard = new ClipboardJS('.copy-button', {
            target: () => textToCopyRef.current || document.body,
        });

        return () => clipboard.destroy();
    }, [listIngreds]);

    const generateChecklistText = (ingredients: any[]) => {
        if (!ingredients) {
            return "";
        }

        return ingredients
            .filter((ingred) => !ingred.complete)
            .map((ingred) => `${ingred.quantity} ${ingred.quantity_type_shorthand || ingred.quantity_type} ${ingred.name}`)
            .join('\n');
    };

    const checklist = generateChecklistText(listIngreds);

    return (
        <div>
            <div id="copyTarget" ref={textToCopyRef} className="absolute left-[-9999px] top-0 whitespace-pre-wrap">
                {checklist}
            </div>
            <Button className="copy-button" variant="outline" data-clipboard-target="#copyTarget">
                Copy to Clipboard
            </Button>
        </div>
    );
};

export default CopyToClipboard;
