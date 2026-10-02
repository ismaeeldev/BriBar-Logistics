# BRIBAR Logistics — Admin Testing Guide

This is a walkthrough for testing the whole application using the real
administrator account (not the automated test credentials used by the
Playwright suite). Follow it top to bottom and you'll touch every major
screen and workflow in the app, as both an Administrator and a Driver.

---

## ⚠️ Before you start — please read

- **This is the real account, connected to the real database.** The
  `.env` file that runs the app locally points at the same production
  database (`neondb` on Neon) as the live deployment configuration. There
  is no disposable "test" copy behind this login — anything created,
  edited, or approved here is a real record, not throwaway data.
- **Approving a service cannot be undone.** The app deliberately has no
  "reject" or "un-approve" action (by design — see the in-app warning
  when you approve). If you approve a service as part of testing, it
  stays approved.
- **Use obviously-fake data for anything you create.** A test vehicle
  plate, route, or driver — name it something like `TEST-` so it's easy
  to find and deactivate afterwards. Deactivating is how the app removes
  things; nothing is ever hard-deleted (by design), so leftover test
  records stay visible until someone deactivates them.
- **Change this password after testing.** It's the seed/bootstrap
  password from the project's environment file. Once testing is done,
  sign in and change it (or ask the developer to rotate it) rather than
  leaving it as-is.
- Please don't forward this document by posting it somewhere public or
  committing it into the project's Git repository — it contains a live
  password.

---

## 1. Getting the app running

If it isn't already running on your machine:

```bash
pnpm install
pnpm dev
```

Then open:

**http://localhost:3000**

The interface will be in **Spanish** by default — that's intentional,
it's what the client sees in production. If you'd rather review the
English strings while testing, stop the server and run `pnpm dev:en`
instead; everything below still applies, just with English labels.

---

## 2. Sign in as Administrator

Go to **http://localhost:3000/login** and sign in with:

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `rj0PU9v8Q6gEctLl` |

You should land on the Admin dashboard at `/admin`.

---

## 3. Admin dashboard (`/admin`)

- Check the summary numbers at the top (services, kilometers, etc. over
  the recent-activity window) render without errors.
- Check the activity chart draws correctly.
- Check the "Recent services" panel lists real recent services (if any
  exist yet) with no broken icons or layout.
- Toggle light/dark mode (if there's a theme switch) and confirm the
  dashboard still reads clearly in both.
- Resize the browser window narrow (phone width) and confirm the layout
  adapts sensibly — this app is used from phones in the field.

---

## 4. Vehicles (`/admin/vehicles`)

1. Open **Vehicles** from the navigation.
2. Confirm the breadcrumb reads "Master Data / Vehicles" and the list of
   existing vehicles loads.
3. Try the **search box** — search by plate and by name, confirm results
   filter correctly, and confirm searching for something that doesn't
   exist shows a clear "no results" message rather than an empty table.
4. Try **Filters** (e.g. filtering to active-only) and confirm it works.
5. Click **New**, create a test vehicle:
   - Plate: `TEST-001` (or similar)
   - Name: `Testing Vehicle`
6. Confirm you land back on the list with the new vehicle visible.
7. Search for `TEST-001`, open it, **edit** the name, save, and confirm
   the change is reflected in the list.
8. Edit it again and **uncheck Active** to deactivate it. Confirm it
   stays in the list marked "Inactive" rather than disappearing.

---

## 5. Routes / Contracts (`/admin/routes`)

Same pattern as Vehicles:

1. Open **Routes**, check the list, search, and Filters all work.
2. Click **New** and create a test route:
   - Code: `TEST-001`
   - Name: `Testing Lane`
   - Origin / Destination: any placeholder text
3. Confirm it appears in the list.
4. Search for it, edit the destination, save, and confirm the change
   shows up.
5. Deactivate it the same way as the vehicle above, and confirm it stays
   visible as "Inactive".

---

## 6. Driver accounts (`/admin/users`)

This is also where you'll create a driver account to test the Driver
side of the app in step 8, so don't skip it.

1. Open **Drivers**, check the list, search box, and Filters.
2. Click **New** and create a test driver:
   - Name: `Test Driver`
   - Username: `test.driver` (lowercase, no spaces — the form will tell
     you if the format is wrong)
   - Password: choose one that does **not** contain the username (the
     app rejects that on purpose) and is at least 12 characters, e.g.
     `TestDriver#2026!`
   - Leave the role as **Driver**.
3. Confirm the new driver appears in the list.
4. **Before logging out**, assign this driver a vehicle and at least one
   route/contract — from what we saw in the code, a driver with no
   vehicle or route configured gets a "administrator configuration
   required" message instead of being able to log a service, so give
   them something to work with (however that's done in the driver's
   edit screen — check for vehicle/route assignment fields there).
5. Edit the driver's name, save, confirm the change shows up.
6. You can leave this driver **active** for now — you'll use it in
   step 8. Come back and deactivate it at the end of testing.

---

## 7. Services list (`/admin/services`)

1. Open **Services**, confirm the list loads (it may be empty if no
   services have been recorded yet — that's fine, come back to this
   after step 8).
2. Check search and any status filters work.
3. Open any existing service and confirm the detail page shows: all the
   automatic fields, the driver-entered fields, the calculated mileage,
   status, timestamps, and (if approved) who approved it and when.

---

## 8. Now test the Driver side

Sign out (the logout button is in the top bar), and sign back in as the
test driver you created in step 6:

| Field | Value |
| --- | --- |
| Username | `test.driver` |
| Password | *(whatever you set in step 6)* |

1. You should land on the **Driver dashboard** (`/driver`) — check the
   greeting, the "Add Service" call-to-action, the three summary
   numbers, and the Pending/Approved lists (both should be empty the
   first time).
2. Tap/click **Add Service**.
3. Fill in the form:
   - Route (should be pre-filtered to only the routes you assigned this
     driver in step 6)
   - Vehicle (same — pre-filtered to their assigned vehicle)
   - Start dashboard km, start base km, end base km, end dashboard km —
     use increasing numbers, e.g. `1000`, `1000`, `1050`, `1060`
   - Any other required fields (service date, notes, etc.)
4. Submit, and confirm it appears under **Pending Approval** on the
   driver dashboard, with the mileage calculated correctly (in this
   example: 60 km actual, 50 km service km).
5. Open **View history** and confirm the new service is there too.
6. Try editing the service (if the driver is allowed to edit while it's
   still pending) and confirm the change saves correctly.

---

## 9. Approve the service, back as Administrator

Sign out and back in as `admin` (step 2), then:

1. Go to **Services**, find the one the test driver just created.
2. Open it and review the details.
3. Click **Approve** — you'll get a confirmation step first (approval is
   irreversible, so take a moment here).
4. Confirm the approval, and confirm the status updates to "Approved",
   with your name and a timestamp recorded.
5. Confirm the service now also shows as "Approved" on the driver's
   dashboard when you check back.

---

## 10. General things to check throughout

While you're going through the steps above, keep an eye on:

- **Responsiveness** — narrow the browser to phone width on every page;
  nothing should overlap, clip, or require horizontal scrolling.
- **Dark mode** — if there's a theme toggle, click through a few pages
  in dark mode and check contrast/readability.
- **Empty states** — searching for something that doesn't exist should
  say so clearly, not show a blank table.
- **Form validation** — try submitting a form with a missing required
  field, or a badly formatted plate/route code/username, and confirm you
  get a clear, specific error rather than a crash or a silent failure.
- **Navigation** — the breadcrumb at the top of every page (home icon →
  section → current page) should always reflect where you actually are.
- **Sign out** — confirm it actually ends the session (try navigating
  back after signing out and confirm you're redirected to the login
  page, not shown a cached page).

---

## 11. When you're done

1. Go back and **deactivate** the test vehicle, test route, and test
   driver you created (steps 4, 5, 6), so they don't linger as clutter
   in the real data.
2. Note down anything that felt broken, confusing, or slow — screenshots
   help a lot if something looks visually wrong.
3. **Change the admin password** (or ask for it to be rotated) now that
   testing is finished.

Send whatever you find back and we'll go through it together.
