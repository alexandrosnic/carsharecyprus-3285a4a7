import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  verified?: boolean | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export const VerifiedBadge = ({
  verified,
  size = "md",
  showLabel = false,
  className,
}: VerifiedBadgeProps) => {
  if (!verified) return null;

  const icon = (
    <BadgeCheck
      className={cn(sizeMap[size], "text-primary fill-primary/15", className)}
      aria-label="ID verified driver"
    />
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            {icon}
            {showLabel && (
              <span className="text-xs font-medium text-primary">Verified</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">ID-verified driver via Stripe Identity</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerifiedBadge;
