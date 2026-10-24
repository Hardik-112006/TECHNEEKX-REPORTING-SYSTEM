import React from 'react';
import './Skeleton.css';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  circle = false,
  className = '',
  style,
  ...props
}) => {
  const inlineStyles: React.CSSProperties = {
    ...style,
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
    borderRadius: circle ? '50%' : undefined,
  };

  return (
    <div
      className={`skeleton-pulse ${circle ? 'skeleton-circle' : ''} ${className}`}
      style={inlineStyles}
      aria-hidden="true"
      {...props}
    />
  );
};
