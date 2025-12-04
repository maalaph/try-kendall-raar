# How to Find Console Logs

## Where to Look for Logs

### Option 1: Terminal Window (Where the server is running)

The logs from our API code will appear in the **Terminal** window where you started the server.

1. **In Cursor/VS Code**: Look at the bottom panel - there should be a "Terminal" tab
2. **Look for lines that say:**
   - `[VAPI INFO]` - Normal information
   - `[VAPI WARNING]` - Warnings (things that might be wrong)
   - `[VAPI DEBUG]` - Debug information
   - `[VAPI ERROR]` - Errors

3. **When you submit the form**, you should see logs like:
   ```
   [VAPI INFO] Setting forwardingPhoneNumber to: +18148528135
   [VAPI DEBUG] forwardingPhoneNumber value: +18148528135
   ```

### Option 2: Browser Developer Console

1. **Open your browser** (Chrome, Safari, Firefox)
2. **Right-click on the page** and select "Inspect" or "Inspect Element"
3. **Click the "Console" tab** at the top
4. **Look for any red error messages**

## What to Look For

When you submit the form with phone number `(814)852-8135`:

- ✅ **Good sign**: You see `[VAPI INFO] Setting forwardingPhoneNumber to: +18148528135`
- ❌ **Bad sign**: You see `[VAPI WARNING] Invalid mobile number for forwarding`

## Quick Test

1. Open the form at: http://localhost:3000/personal-setup
2. Fill in the form with:
   - Mobile Number: `(814)852-8135`
   - Make sure "Forward calls" is checked if you want call forwarding
3. Submit the form
4. Check the Terminal window (bottom of Cursor) for the logs
5. Share what you see in the logs!















