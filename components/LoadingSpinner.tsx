export function LoadingSpinner() {
    return (
        <div className="flex justify-center p-8">
            <div className="w-12 h-12 rounded-full bg-accent shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-[lds_circle_2.4s_cubic-bezier(0,0.2,0.8,1)_infinite]"></div>
        </div>
    );
}
