import { useEffect } from 'react'

// Number keys 1–8 pick categories in this order (matches the prototype)
export const CATEGORIES = ['Groceries', 'Transportation', 'Shopping', 'Dining', 'Other', 'Health', 'Entertainment', 'Travel']

function isTypingTarget(el) {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

// Page-wide keys: ← → month, 1–8 category, 0 clears it, / focuses search, Esc clears all filters.
// Ignored while typing (except Esc) or while a dialog is open.
export function useFilterKeys({ onStep, onCategory, onClear, searchRef }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      // A dialog or the account menu handles its own keys (Esc closes it instead of clearing filters)
      if (document.querySelector('[role="dialog"], [aria-modal="true"], .account-menu')) return
      const typing = isTypingTarget(e.target)
      if (e.key === 'Escape') {
        onClear()
        if (typing) e.target.blur()
        return
      }
      if (typing) return
      if (e.key === 'ArrowLeft') onStep(-1)
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      } else if (/^[1-8]$/.test(e.key)) onCategory(CATEGORIES[Number(e.key) - 1])
      else if (e.key === '0') onCategory(null)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStep, onCategory, onClear, searchRef])
}
