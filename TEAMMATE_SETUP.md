# Setup Instructions for Your Teammate

## Quick Setup - Use Production Key

Add these to your `.env.local` file:

```bash
TRIGGER_SECRET_KEY=tr_prod_P3q3mZZIETOlH1kwzttK
TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
```

(You can also add `TRIGGER_API_KEY=tr_prod_P3q3mZZIETOlH1kwzttK` for legacy support, but `TRIGGER_SECRET_KEY` is the main one)

## That's It! ✅

- ✅ Same key as your teammate
- ✅ Tasks run automatically in Trigger.dev's cloud
- ✅ No need to run `npm run trigger:dev`
- ✅ Works for testing and will work when deployed

## Testing

1. Restart your Next.js server: `npm run dev`
2. Trigger a task from your app
3. Check https://cloud.trigger.dev to see tasks execute

## Important Notes

- ❌ **Don't run** `npm run trigger:dev` (only needed for dev keys)
- ✅ Tasks run automatically in cloud
- ✅ Both of you can work simultaneously
- ✅ Same setup works for deployment

