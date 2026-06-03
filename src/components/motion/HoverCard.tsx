/**
 * Subtle lift on hover for dashboard cards.
 */
import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

const hoverCardProps = {
  whileHover: { y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.15)' },
  transition: { duration: 0.15 },
} as const;

export function HoverCard({ children, className, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div className={className} {...hoverCardProps} {...rest}>
      {children}
    </motion.div>
  );
}

export default HoverCard;
