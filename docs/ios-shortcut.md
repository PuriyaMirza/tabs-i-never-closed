# iOS Shortcut: share tabs to "Tabs I Never Closed"

This builds a Shortcut that shows up in the iPhone **share sheet**. Share one
page (or several Chrome tabs at once), tap the Shortcut, and a notification
tells you what was saved, for example "Saved 3 (1 duplicate)".

It takes about 5 minutes. You only do it once. The steps use the iOS 18
Shortcuts app. Button names can differ slightly between iOS versions, so
where a name isn't exact, look for the closest match.

**Before you start:** open the **Passwords** app, find the entry called
**Tabs secret**, and keep it handy. That is your `LINKS_SECRET`.

## Build it

### 1. Create the Shortcut

1. Open the **Shortcuts** app.
2. Tap **+** (top right) to start a new Shortcut.
3. Tap the name at the top and choose **Rename**. Call it **Save to Tabs**.

### 2. Make it appear in the share sheet

1. Open the Shortcut's settings: tap the **info (i)** button, or the name at
   the top and then **Details** (the exact spot depends on your iOS version).
2. Turn on **Show in Share Sheet**.
3. Tap **Share Sheet Types** (it may say "Any" or list several types).
   Choose only these and untick the rest:
   - **URLs**
   - **Text**
   - **Safari web pages** (if the list has it)
4. Go back to the Shortcut. The first action is now
   **Receive ... from Share Sheet**. Leave it as it is.

### 3. Pull the links out of whatever was shared

1. Tap **Add Action** (or the search bar at the bottom) and search for
   **Get URLs from Input**. Tap it to add it.
2. Its input should say **Shortcut Input**. That is the default, so you
   don't need to change anything.

### 4. Send the links to the app (one request for all of them)

1. Add the action **Get Contents of URL**.
2. Tap the **URL** field and type exactly:

   ```
   https://tabs-i-never-closed.vercel.app/api/links
   ```

3. Tap **Show More** (or the small arrow) on that action to reveal its
   options.
4. Set **Method** to **POST**.
5. Under **Headers**, tap **Add new header**:
   - **Key:** `x-links-secret`
   - **Text (value):** paste your secret from the Passwords entry
     "Tabs secret". Paste it with no extra spaces or line breaks.
6. Set **Request Body** to **JSON**.
7. Under the JSON body, tap **Add new field** and pick **Text** as its
   type (not "List" or "Dictionary"):
   - **Key:** `urls`
   - **Value:** tap the value box. In the bar above the keyboard, choose
     the **URLs** variable. It is the output of "Get URLs from Input". It
     should appear as a coloured **URLs** bubble in the box. Don't type
     anything else in the box.

**Why Text?** When you put a list of URLs into a Text field, Shortcuts joins
them into one block of text with a line break between each link, and the
server picks every URL out of that text, so it works the same whether you
shared one link or ten.

### 5. Show the result as a notification

1. Add the action **Get Dictionary Value**.
2. Make it read: **Get** `Value` **for** `message` **in** *Contents of URL*.
   - Tap the word after "Get" and pick **Value** if it says something else.
   - Tap the key box and type `message`.
   - Make sure the last box is the **Contents of URL** bubble (the result
     of the previous action). If it says "Dictionary" and is empty, tap it
     and choose **Contents of URL**.
3. Add the action **Show Notification**.
4. Set its text to the **Dictionary Value** bubble from the previous
   action. Optionally set the title to "Tabs".

Your Shortcut should now be four actions in this order, after
"Receive from Share Sheet":

1. Get URLs from Input
2. Get Contents of URL (POST to the app, with the header and the JSON body)
3. Get Dictionary Value (`message`)
4. Show Notification

Tap **Done**.

> **Keep it private.** Your secret is stored inside this Shortcut. Don't
> share the Shortcut with anyone, and don't use "Copy iCloud Link" on it.

## Test it

**Test 1: one Safari page**

1. In Safari, open any web page.
2. Tap the **Share** button, scroll the row of apps/actions, and tap
   **Save to Tabs**.
3. The first time, iOS asks whether the Shortcut may connect to
   `tabs-i-never-closed.vercel.app`. Tap **Allow** (or **Always Allow**).
4. You should get a notification like "Saved 1".
5. Open the app and check the link is in your list. Its title and tag may
   take a few seconds to appear.

**Test 2: three Chrome tabs, one already saved**

1. Make sure one of the three pages is already saved (for example, the page
   from Test 1).
2. In Chrome, open the **tab grid** (the square with a number), tap
   **Select** (or the three dots then **Select Tabs**), and tick three tabs,
   including the one already saved.
3. Tap **Share** and choose **Save to Tabs**.
4. You should get a notification like **"Saved 2 (1 duplicate)"**.

## If something goes wrong

**The Shortcut isn't in the share sheet.**
Scroll to the bottom of the share sheet's action list and tap **Edit
Actions**. Find **Save to Tabs** in the list and turn it on (you can also
add it to Favorites to put it near the top). If it isn't in that list at all,
go back to step 2 and check **Show in Share Sheet** is on and that **URLs**
and **Text** are ticked.

**The notification says "Error: wrong secret".**
The secret in the Shortcut doesn't match `LINKS_SECRET` in Vercel. Open the
Passwords app, copy **Tabs secret** again, open the Shortcut, tap the
header's value, delete it and paste the new one (no spaces before or after).

**Nothing happens at all.**
The Shortcut probably doesn't have permission to connect. Run it once from
inside the Shortcuts app (tap it). When iOS asks to connect to
`tabs-i-never-closed.vercel.app`, tap **Allow**. If you tapped "Don't
Allow" by mistake, the easiest fix is to delete the Shortcut and rebuild it,
then tap **Allow** when asked. Also check you have an internet connection.

**The notification says "Error: no valid link to save".**
The app found no web links in what you shared (for example, a plain note with
no URL). Share the page itself rather than a text selection.
