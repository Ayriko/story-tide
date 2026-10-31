import "react";

// Variables CSS personnalisees (--nom) acceptees dans la prop `style` (KAN-85 :
// masques du ciel de fond poses par monde sur la Constellation). Declaration
// explicite plutot qu'un `as React.CSSProperties` a chaque usage.
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
