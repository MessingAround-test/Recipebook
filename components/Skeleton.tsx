import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = "",
    width,
    height,
    circle = false
}) => {
    const style: React.CSSProperties = {
        width: width,
        height: height,
    };

    return (
        <div
            className={`animate-pulse bg-white/10 rounded-md ${circle ? 'rounded-full' : ''} ${className}`}
            style={style}
        />
    );
};

export default Skeleton;
