import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[100] bg-gradient-to-br from-black/90 via-slate-950/95 to-black/90 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[101] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE DE BOAS-VINDAS PROFISSIONAL MSK
// ═══════════════════════════════════════════════════════════════════════════

interface MSKWelcomePopupProps {
  /** Controls whether the popup is open */
  open?: boolean;
  /** Callback when the popup requests to close */
  onOpenChange?: (open: boolean) => void;
  /** Logo URL - uses default MSK logo if not provided */
  logoUrl?: string;
  /** Company name */
  companyName?: string;
  /** Custom welcome message */
  welcomeMessage?: string;
  /** Custom description */
  description?: string;
  /** Button label */
  buttonLabel?: string;
}

const MSKWelcomePopup: React.FC<MSKWelcomePopupProps> = ({
  open,
  onOpenChange,
  logoUrl,
  companyName = "MSK Pro Studio",
  welcomeMessage = "Bem-vindo ao futuro",
  description = "Transformamos suas ideias em experiências digitais extraordinárias. Somos especialistas em desenvolvimento de interfaces modernas, sistemas web e soluções tecnológicas de alto impacto.",
  buttonLabel = "Começar a Explorar",
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl">
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 animate-pulse" />
          
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30 bg-[length:200%_100%] animate-[shine_3s_ease-in-out_infinite]" />
          
          {/* Inner content container */}
          <div className="relative z-10 flex flex-col items-center px-8 py-12 sm:px-12 sm:py-16">
            {/* Logo container with glow effect */}
            <div className="relative mb-8">
              {/* Outer glow ring */}
              <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-50" />
              
              {/* Logo */}
              <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl backdrop-blur-sm sm:h-28 sm:w-28">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${companyName} Logo`}
                    className="h-16 w-16 rounded-xl object-contain sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                      MSK
                    </span>
                    <span className="mt-1 text-xs font-medium uppercase tracking-widest text-cyan-400/80 sm:text-sm">
                      Pro Studio
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Welcome title */}
            <div className="mb-2 text-center">
              <h1 className="bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {welcomeMessage}
              </h1>
            </div>
            
            {/* Company name */}
            <p className="mb-6 text-center text-lg font-semibold text-cyan-400 sm:text-xl">
              {companyName}
            </p>
            
            {/* Description */}
            <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-slate-400 sm:text-base">
              {description}
            </p>
            
            {/* Features badges */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              {["Design Premium", "Alta Performance", "Inovação", "Qualidade"].map((feature, index) => (
                <span
                  key={feature}
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 sm:text-sm"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {feature}
                </span>
              ))}
            </div>
            
            {/* CTA Button */}
            <button
              onClick={() => onOpenChange?.(false)}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/40 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                {buttonLabel}
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            
            {/* Close hint */}
            <p className="mt-6 text-xs text-slate-500">
              Pressione ESC ou clique fora para fechar
            </p>
          </div>
          
          {/* Decorative corner elements */}
          <div className="absolute left-0 top-0 h-16 w-16 border-l-2 border-t-2 rounded-tl-2xl border-cyan-500/50" />
          <div className="absolute right-0 top-0 h-16 w-16 border-r-2 border-t-2 rounded-tr-2xl border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 h-16 w-16 border-b-2 border-l-2 rounded-bl-2xl border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 h-16 w-16 border-b-2 border-r-2 rounded-br-2xl border-cyan-500/50" />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK PARA CONTROLE AUTOMÁTICO DO POPUP (EXIBE UMA VEZ POR SESSÃO)
// ═══════════════════════════════════════════════════════════════════════════

const MSK_POPUP_KEY = "msk-welcome-popup-dismissed";

interface UseMSKWelcomePopupOptions {
  /** Delay in ms before showing the popup (default: 800ms) */
  delay?: number;
  /** Whether to show the popup on every page load (default: false) */
  showEveryTime?: boolean;
}

const useMSKWelcomePopup = (options: UseMSKWelcomePopupOptions = {}) => {
  const { delay = 800, showEveryTime = false } = options;
  const [isOpen, setIsOpen] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  
  React.useEffect(() => {
    // Check if popup was already dismissed in this session
    const wasDismissed = sessionStorage.getItem(MSK_POPUP_KEY);
    
    if (wasDismissed && !showEveryTime) {
      setIsReady(true);
      return;
    }
    
    // Show popup after delay
    const timer = setTimeout(() => {
      setIsOpen(true);
      setIsReady(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay, showEveryTime]);
  
  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open);
    
    if (!open) {
      // Remember that user dismissed the popup
      sessionStorage.setItem(MSK_POPUP_KEY, "true");
    }
  }, []);
  
  return { isOpen, isReady, onOpenChange: handleOpenChange };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRONTO PARA USO (EXIBE AUTOMATICAMENTE UMA VEZ)
// ═══════════════════════════════════════════════════════════════════════════

interface MSKWelcomePopupAutoProps extends Omit<MSKWelcomePopupProps, "open" | "onOpenChange"> {
  /** Delay before showing */
  delay?: number;
  /** Show every time (default: false) */
  showEveryTime?: boolean;
}

const MSKWelcomePopupAuto: React.FC<MSKWelcomePopupAutoProps> = ({
  delay = 800,
  showEveryTime = false,
  ...props
}) => {
  const { isOpen, onOpenChange } = useMSKWelcomePopup({ delay, showEveryTime });
  
  if (!isOpen) return null;
  
  return (
    <MSKWelcomePopup
      open={isOpen}
      onOpenChange={onOpenChange}
      {...props}
    />
  );
};

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  MSKWelcomePopup,
  MSKWelcomePopupAuto,
  useMSKWelcomePopup,
};