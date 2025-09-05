
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Set initial value immediately to prevent hydration mismatch
    const checkIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT
    setIsMobile(checkIsMobile())

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(checkIsMobile())
    }
    
    // Use passive listener for better performance
    mql.addEventListener("change", onChange, { passive: true })
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
