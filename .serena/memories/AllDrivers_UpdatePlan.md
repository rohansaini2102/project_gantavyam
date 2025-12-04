# AllDrivers.js Update Plan

## Current State Analysis

### What AllDrivers.js Currently Shows:
1. **Status Column** (Driver Account Status):
   - Active (green, approved drivers)
   - Pending (yellow, pending verification)
   
2. **Online Status Column** (Simple Toggle):
   - Online (green WiFi icon)
   - Offline (gray WiFi off icon)
   - Set Online/Set Offline buttons (only for approved drivers)

### What Changed in New Driver Session System:
Backend now has new fields in Driver model:
- `inQueue` (Boolean) - Whether driver is in a queue
- `connectionStatus` (String) - Three states: 'connected', 'disconnected', 'offline'
- `queuePosition` (Number) - Position in queue
- `lastActiveTime` (Date) - When driver was last active

## New Connection Status States:
1. **Online (connected)** - Driver is online and socket is connected
2. **Not Reachable (disconnected)** - Driver is in queue but socket disconnected
3. **Offline** - Driver is completely offline, not in queue

## Implementation in Other Pages:

### ManualBooking.js (REFERENCE):
Lines 2140-2152 show the badge rendering pattern:
```jsx
{driver.connectionStatus === 'connected' || (driver.isOnline && !driver.connectionStatus) ? (
  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full flex items-center">
    🟢 Online
  </span>
) : driver.connectionStatus === 'disconnected' || (!driver.isOnline && driver.inQueue) ? (
  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full flex items-center">
    ⚠️ Not Reachable
  </span>
) : (
  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full flex items-center">
    ⚫ Offline
  </span>
)}
```

Also shows "Last Seen" time for Not Reachable drivers (lines 2170-2179)

### QueueManagement.js:
Uses simple Online/Offline display (not yet updated to 3-state system)

## Socket Events Already in AllDrivers.js:
- driverStatusUpdated (line 94)
- adminToggleDriverStatusConfirmed (line 113)
- adminToggleDriverStatusError (line 121)
- queuePositionsUpdated (line 149)

These events already handle `inQueue`, `connectionStatus` data updates (lines 98-169)

## Recommended Changes to AllDrivers.js:

### 1. Update Socket Listeners:
Add listener for new connection status events:
- `driverConnectionStatusChanged` - when connectionStatus changes

### 2. Update Online Status Column Display:
Replace simple Online/Offline badges with:
- Green 🟢 Online badge when connectionStatus === 'connected'
- Yellow ⚠️ Not Reachable badge when connectionStatus === 'disconnected'
- Gray ⚫ Offline badge when connectionStatus === 'offline'
- Show "Last seen: X min ago" for Not Reachable drivers

### 3. Add Queue Position Display:
- Show queue position in Online Status column or separate column
- Only show for drivers that are inQueue

### 4. Update Toggle Button Logic:
Currently only shows for approved drivers and toggles isOnline
- Should work with new connection status
- Label should match the current state more clearly

### 5. Update State Management:
Ensure queuePosition and connectionStatus are included in state updates

## UI Location Options:
1. **Replace "Online Status" column** with 3-state status (existing column)
2. **Add new "Connection Status" column** (more explicit but adds width)
3. **Update same "Online Status" column** and add queue info inline

Best approach: Option 1 - Replace in same column for consistency
