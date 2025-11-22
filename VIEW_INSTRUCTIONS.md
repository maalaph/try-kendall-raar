# How to View Your RAAR Landing Page

## Quick Start

1. **Open your web browser** (Chrome, Safari, Firefox, etc.)

2. **Go to this address:**
   ```
   http://localhost:3000
   ```

3. **You should see:**
   - A black background (RAAR's dark theme)
   - A video placeholder on the left with a purple glow
   - Headline: "Ever wonder how much smoother your day could feel? Meet Kendall."
   - Bullet points about Kendall's features
   - A "Your move → Book your demo" button
   - A booking section with a form and calendar placeholder

## If the page doesn't load:

The development server might not be running. Open Terminal and run:

```bash
cd /Users/rm/Desktop/raar/landing-page
npm run dev
```

Wait for it to say "Ready" and then refresh your browser.

## What to Look For:

✅ **Dark black background** - Should be pure black (#000000)  
✅ **Purple glow** - The video frame should have a subtle purple pulsing glow  
✅ **Clean, minimal design** - No clutter, lots of space  
✅ **Responsive** - Try resizing your browser window to see it adapt  
✅ **Smooth scrolling** - Click the "Book your demo" button to scroll to the form  
✅ **Form validation** - Try submitting the form empty or with an invalid URL to see error messages  

## To Stop the Server:

Press `Ctrl + C` in the terminal where it's running.

## To Restart:

Just run `npm run dev` again in the landing-page folder.

