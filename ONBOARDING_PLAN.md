# My Kendall Onboarding - Complete Plan

## UI/UX Design - Cool & Interactive Wizard

### Overall Structure
**Full-screen wizard experience** with smooth step transitions. Each step takes up the viewport with a clean, focused layout. Game-like feel with engaging animations and micro-interactions.

### Visual Design Elements

**1. Progress Indicator (Top of Screen)**
- Horizontal progress bar showing current step (1/5, 2/5, etc.)
- Smoothly animates as user progresses (fills with accent color)
- Dots or segments that light up/glow when completed
- Uses accent color (`colors.accent`) for active/completed states
- Subtle pulse animation on current step dot

**2. Step Transitions**
- **Slide animation:** Current step slides out left, new step slides in from right
- Smooth easing (ease-in-out cubic-bezier)
- 300-400ms transition duration
- Optional: subtle parallax effect on background elements

**3. Step 1 & 2: Form Inputs**
- Large, clean input fields with floating labels
- Labels animate up on focus (material-style)
- Accent color border glow on focus
- Smooth focus transitions (200ms)
- Input validation with gentle shake animation on error
- Mobile-friendly touch targets (min 44px height)

**4. Step 3: Personality Traits - Interactive Card Selection**
- **Card Grid Layout:** 3 columns on desktop, 2 on tablet, 1 on mobile
- **Card Design:**
  - Each trait is a large, tappable card (min 120px height)
  - Card shows trait name prominently with subtle icon/emoji
  - **Hover state:** Scale up (1.05x) + glow effect with accent color
  - **Selected state:** Accent color border (2-3px) + background glow + checkmark icon
  - **Selection counter:** "2 of 3 selected" indicator above cards
  - **Disabled state:** Cards become semi-transparent (opacity 0.4) when max reached
- **Selection Animation:**
  - Checkmark icon animates in with scale + fade
  - Selected card "locks in" with subtle bounce effect (1.1x scale then back)
  - Selected cards glow with accent color shadow
  - Smooth color transitions on selection/deselection
- **Interaction Feedback:**
  - Click/tap to select/deselect
  - Immediate visual feedback on every interaction

**5. Step 4: Use Case - Single Card Selection**
- **Card Layout:** Single column, large cards (full-width on mobile, centered on desktop)
- Each use case card includes:
  - Large icon/emoji on left (or top on mobile)
  - Title and brief 1-line description
  - **Hover:** Subtle lift effect (translateY -4px) + glow
  - **Selected:** Accent border (3px) + glow + checkmark
- **Selection Animation:**
  - Selected card slides slightly forward (z-index elevation)
  - Radio button-style selection indicator animates in
  - Smooth selection transition (200ms)

**6. Step 5: Combined Text Field & Checkboxes**
- **Large textarea:**
  - Auto-resize as user types (min 150px, max 400px height)
  - Helpful placeholder with example text
  - Character count indicator (optional, subtle)
  - Focus state: accent border glow + subtle scale (1.01x)
  - Smooth focus transitions
- **Privacy checkboxes below:**
  - Animated custom checkboxes (not default HTML)
  - Smooth check/uncheck animations (scale + fade)
  - Subtle hover states
  - Grid layout (2 columns on desktop, 1 on mobile)

**7. Navigation Buttons**
- **Back Button:** 
  - Always visible (except step 1)
  - Left side of screen or bottom left
  - Subtle, low-contrast (doesn't distract)
  - Smooth hover: slight scale + opacity change
- **Next/Continue Button:**
  - Large, prominent CTA button (bottom right or centered)
  - **Disabled state:** Grayed out, non-interactive
  - **Enabled state:** Accent color background + text glow
  - **Hover:** Scale up (1.05x) + increased glow
  - **Active/Click:** Scale down (0.95x) briefly
  - **Loading state:** Spinner animation on submit (replace button text)

**8. Micro-Interactions & Animations**
- **Button hover:** Scale (1.05x) + glow + smooth transition
- **Card hover:** Lift effect (translateY -4px) + glow
- **Input focus:** Border glow + label animation
- **Success state:** Confetti animation on completion (use existing confetti library)
- **Error state:** Gentle shake animation (translateX -10px to 10px) + red accent
- **Loading states:** Subtle pulse animation or spinner
- **Page transitions:** Smooth fade between steps
- All animations use hardware acceleration (transform, opacity)

**9. Typography & Spacing**
- Clean, modern fonts (existing font system)
- Large headings for step titles (clamp for responsive)
- Generous spacing between elements (1.5rem minimum)
- Mobile-first: Touch-friendly button sizes (min 44px height/width)
- Readable text sizes (16px minimum, clamp for responsive)

**10. Color Scheme & Theme**
- Use existing `colors` from config
- Accent color for selections, highlights, progress (`colors.accent`)
- Dark background (existing theme - `colors.secondary` or `colors.primary`)
- White/light text (`colors.text`)
- Accent glow effects on interactive elements (box-shadow with accent color + opacity)

**11. Responsive Design**
- Mobile-first approach
- Touch-optimized card sizes (min 120px height)
- Stack vertically on mobile
- Horizontal/grid layout on desktop
- Smooth transitions across all screen sizes
- Breakpoints: mobile (< 768px), tablet (768px - 1024px), desktop (> 1024px)

**12. Game-Like Elements**
- **Achievement feedback:** Subtle celebration animation when max traits selected (3/3)
- **Progress rewards:** Visual feedback as user completes steps (progress bar fills, dots light up)
- **Smooth animations:** Every interaction feels polished and responsive
- **Completion celebration:** Confetti + success message on final submission

**13. Accessibility**
- Keyboard navigation support (tab, enter, arrow keys)
- Focus indicators visible and clear
- Screen reader friendly labels
- ARIA attributes where needed
- High contrast ratios for text

### Component Architecture

**Main Wizard Component Structure:**
```tsx
<OnboardingWizard>
  <ProgressIndicator currentStep={step} totalSteps={5} />
  <WizardStep step={1} active={step === 1}>
    <BasicInfoForm />
  </WizardStep>
  <WizardStep step={2} active={step === 2}>
    <KendallNameInput />
  </WizardStep>
  <WizardStep step={3} active={step === 3}>
    <PersonalityTraitCards maxSelections={3} />
  </WizardStep>
  <WizardStep step={4} active={step === 4}>
    <UseCaseCards singleSelect />
  </WizardStep>
  <WizardStep step={5} active={step === 5}>
    <ContextAndRulesTextarea />
    <PrivacyBoundariesCheckboxes />
  </WizardStep>
  <WizardNav 
    canGoBack={step > 1}
    canContinue={isStepValid}
    onBack={handleBack}
    onNext={handleNext}
    isLoading={isSubmitting}
  />
</OnboardingWizard>
```

**Animation Strategy:**
- Use CSS transitions for simple animations (hover, focus, color changes)
- Use CSS keyframes for complex animations (shake, bounce, pulse)
- Consider `framer-motion` for complex step transitions (optional enhancement)
- Keep animations smooth (60fps) and purposeful
- Respect `prefers-reduced-motion` media query for accessibility

**Performance Considerations:**
- Hardware-accelerated animations (use transform, opacity)
- Debounce text input handlers if needed
- Optimize images/icons (use SVGs where possible)















