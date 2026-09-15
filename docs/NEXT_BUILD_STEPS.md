# Next Build Steps

## 1. Connect real Google OAuth
- Configure Google Cloud OAuth consent screen
- Create iOS and Android OAuth clients
- Backend OAuth callback
- Store refresh tokens encrypted server-side

## 2. Implement Gmail service
- List labels
- Fetch recent messages
- Fetch single thread
- Map Gmail message IDs to mobile records

## 3. Implement Gmail Watch
- Create Pub/Sub topic
- Grant Gmail publisher permission
- Register users with users.watch
- Renew watches automatically

## 4. Push notifications
- Add Firebase project
- Register mobile push token
- Backend endpoint `/devices/register`
- Send push only after priority engine says important

## 5. Exact-email navigation
- Notification opens `prioritymail://email/:messageId`
- Email detail screen provides "Open in Gmail"
- Browser fallback if Gmail app cannot be opened
