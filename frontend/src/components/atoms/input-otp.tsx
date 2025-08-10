"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Dot } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

// const InputOTPSlot = React.forwardRef<
//   React.ElementRef<"div">,
//   React.ComponentPropsWithoutRef<"div"> & { index: number }
// >(({ index, className, ...props }, ref) => {
//   const inputOTPContext = React.useContext(OTPInputContext)
//   const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]
//         // "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",

//   return (
//     <div
//       ref={ref}
//       className={cn(
//         "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all",
//         isActive && "z-10 ring-2 ring-ring ring-offset-background",
//         className
//       )}
//       {...props}
//     >
//       {char}
//       {hasFakeCaret && (
//         <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
//           <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
//         </div>
//       )}
//     </div>
//   )
// })
const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        // Estilos base: solo borde inferior, sin redondeos
        "relative flex h-12 w-12 items-center justify-center border-b border-gray-300 text-lg font-medium transition-all",
        // Estilo cuando está activo (en foco)
        isActive && "border-b-2 border-blue-500 outline-none ring-0",
        // Clases personalizadas desde las props
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Dot />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
