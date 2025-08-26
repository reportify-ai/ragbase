"use client"

import * as React from "react"

interface TooltipProps {
  children: React.ReactNode
  content: string
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function Tooltip({ 
  children, 
  content, 
  side = "top", 
  className = ""
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [actualSide, setActualSide] = React.useState(side)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  
  const updatePosition = React.useCallback(() => {
    if (!containerRef.current) return
    
    // Get the first child element (the actual button/trigger)
    const targetElement = containerRef.current.firstElementChild as HTMLElement
    if (!targetElement) return
    
    const rect = targetElement.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    
    let newSide = side
    
    // Check space and adjust position
    if (side === "top" && rect.top < 80) {
      newSide = "bottom"
    } else if (side === "bottom" && rect.bottom > viewportHeight - 80) {
      newSide = "top"
    } else if (side === "left" && rect.left < 150) {
      newSide = "right"
    } else if (side === "right" && rect.right > viewportWidth - 150) {
      newSide = "left"
    }
    setActualSide(newSide)
  }, [side])
  
  const handleMouseEnter = () => {
    setIsVisible(true)
    updatePosition()
  }
  
  const handleMouseLeave = () => {
    setIsVisible(false)
  }
  
  // Calculate tooltip position styles
  const getTooltipClasses = () => {
    const base = "absolute z-[9999] px-3 py-2 text-sm font-medium text-white bg-black rounded-md shadow-xl pointer-events-none whitespace-nowrap"
    
    switch (actualSide) {
      case "top":
        return `${base} bottom-full left-1/2 -translate-x-1/2 mb-2`
      case "bottom":
        return `${base} top-full left-1/2 -translate-x-1/2 mt-2`
      case "left":
        return `${base} right-full top-1/2 -translate-y-1/2 mr-2`
      case "right":
        return `${base} left-full top-1/2 -translate-y-1/2 ml-2`
      default:
        return base
    }
  }
  
  const renderArrow = () => {
    const arrowSize = 8
    const arrowColor = "#000000" // Black
    
    switch (actualSide) {
      case "top":
        return (
          <div 
            className="absolute top-full left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: `${arrowSize}px solid transparent`,
              borderRight: `${arrowSize}px solid transparent`,
              borderTop: `${arrowSize}px solid ${arrowColor}`
            }}
          />
        )
      case "bottom":
        return (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: `${arrowSize}px solid transparent`,
              borderRight: `${arrowSize}px solid transparent`,
              borderBottom: `${arrowSize}px solid ${arrowColor}`
            }}
          />
        )
      case "left":
        return (
          <div 
            className="absolute left-full top-1/2 -translate-y-1/2"
            style={{
              width: 0,
              height: 0,
              borderTop: `${arrowSize}px solid transparent`,
              borderBottom: `${arrowSize}px solid transparent`,
              borderLeft: `${arrowSize}px solid ${arrowColor}`
            }}
          />
        )
      case "right":
        return (
          <div 
            className="absolute right-full top-1/2 -translate-y-1/2"
            style={{
              width: 0,
              height: 0,
              borderTop: `${arrowSize}px solid transparent`,
              borderBottom: `${arrowSize}px solid transparent`,
              borderRight: `${arrowSize}px solid ${arrowColor}`
            }}
          />
        )
      default:
        return null
    }
  }
  
  // Clone the child element and add our event handlers
  const childElement = React.Children.only(children) as React.ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
  }>
  
  const handleChildMouseEnter = (e: React.MouseEvent) => {
    handleMouseEnter()
    // Call original onMouseEnter if exists
    if (childElement.props.onMouseEnter) {
      childElement.props.onMouseEnter(e)
    }
  }
  
  const handleChildMouseLeave = (e: React.MouseEvent) => {
    handleMouseLeave()
    // Call original onMouseLeave if exists  
    if (childElement.props.onMouseLeave) {
      childElement.props.onMouseLeave(e)
    }
  }
  
  const clonedChild = React.cloneElement(childElement, {
    onMouseEnter: handleChildMouseEnter,
    onMouseLeave: handleChildMouseLeave
  })

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
    >
      {clonedChild}
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`${getTooltipClasses()} transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'} ${className}`}
          style={{ pointerEvents: 'none' }}
        >
          {content}
          {renderArrow()}
        </div>
      )}
    </div>
  )
}
