export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

export const convertBlobToBase64 = async (blob: Blob) => {
    return await blobToBase64(blob);
}

export const compressImage = async (base64String: string, maxMB: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64String;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const maxDim = 1600;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = (height / width) * maxDim;
                    width = maxDim;
                } else {
                    width = (width / height) * maxDim;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            let quality = 0.8;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            while (dataUrl.length > maxMB * 1024 * 1024 * 1.33 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(dataUrl);
        };
    });
};

export const fileToBase64 = (file: File, onStatus?: (status: string) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function () {
            let base64 = reader.result as string;
            if (file.size > 1 * 1024 * 1024) {
                onStatus?.("Compressing image...");
                base64 = await compressImage(base64, 0.7);
                onStatus?.("");
            }
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Like fileToBase64 but always keeps the payload safely under the API's 1 MB
 * body limit — files up to 1 MB can still base64 to ~1.37 MB and get rejected,
 * so anything over ~700 KB of base64 is re-encoded smaller.
 */
export const fileToCompressedBase64 = async (file: File, onStatus?: (status: string) => void): Promise<string> => {
    const base64 = await blobToBase64(file);
    if (base64.length <= 700 * 1024) return base64;
    onStatus?.('Compressing image…');
    try {
        return await compressImage(base64, 0.5);
    } finally {
        onStatus?.('');
    }
};
