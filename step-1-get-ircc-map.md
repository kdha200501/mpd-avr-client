# Plan: Add TV Control Map Fetching

## Context

The user wants to improve the TV mode by watching remote key events and relaying them as HTTP calls. The first step is to fetch the TV control map (remote controller info) from the Sony Bravia TV. This map contains the mapping of remote control button names to their IRCC values, which will be used to relay key events to the TV.

- example request

  ```shell
  curl -v -X POST http://192.168.0.28/sony/system \
       -H "Content-Type: application/json" \
       -H "X-Auth-PSK: ZUf11g6juY" \
       -d '{
             "method": "getRemoteControllerInfo",
             "id": 1,
             "params": [],
             "version": "1.0"
           }'
  ```

- example response

  ```json
  {
    "result": [
      { "bundled": true, "type": "RMF-TX500" },
      [
        { "name": "Home", "value": "AAAAAQAAAAEAAABgAw==" },
        { "name": "Return", "value": "AAAAAgAAAJcAAAAjAw==" },
        { "name": "Num1", "value": "AAAAAQAAAAEAAAAAAw==" },
        { "name": "Num2", "value": "AAAAAQAAAAEAAAABAw==" },
        { "name": "Num3", "value": "AAAAAQAAAAEAAAACAw==" },
        { "name": "Num4", "value": "AAAAAQAAAAEAAAADAw==" },
        { "name": "Num5", "value": "AAAAAQAAAAEAAAAEAw==" },
        { "name": "Num6", "value": "AAAAAQAAAAEAAAAFAw==" },
        { "name": "Num7", "value": "AAAAAQAAAAEAAAAGAw==" },
        { "name": "Num8", "value": "AAAAAQAAAAEAAAAHAw==" },
        { "name": "Num9", "value": "AAAAAQAAAAEAAAAIAw==" },
        { "name": "Num0", "value": "AAAAAQAAAAEAAAAJAw==" },
        { "name": "DOT", "value": "AAAAAgAAAJcAAAAdAw==" },
        { "name": "VolumeUp", "value": "AAAAAQAAAAEAAAASAw==" },
        { "name": "VolumeDown", "value": "AAAAAQAAAAEAAAATAw==" },
        { "name": "Mute", "value": "AAAAAQAAAAEAAAAUAw==" },
        { "name": "TvPower", "value": "AAAAAQAAAAEAAAAVAw==" },
        { "name": "EPG", "value": "AAAAAgAAAKQAAABbAw==" },
        { "name": "Confirm", "value": "AAAAAQAAAAEAAABlAw==" },
        { "name": "ChannelUp", "value": "AAAAAQAAAAEAAAAQAw==" },
        { "name": "ChannelDown", "value": "AAAAAQAAAAEAAAARAw==" },
        { "name": "Up", "value": "AAAAAQAAAAEAAAB0Aw==" },
        { "name": "Down", "value": "AAAAAQAAAAEAAAB1Aw==" },
        { "name": "Left", "value": "AAAAAQAAAAEAAAA0Aw==" },
        { "name": "Right", "value": "AAAAAQAAAAEAAAAzAw==" },
        { "name": "Display", "value": "AAAAAQAAAAEAAAA6Aw==" },
        { "name": "SubTitle", "value": "AAAAAgAAAJcAAAAoAw==" },
        { "name": "Audio", "value": "AAAAAQAAAAEAAAAXAw==" },
        { "name": "MediaAudioTrack", "value": "AAAAAQAAAAEAAAAXAw==" },
        { "name": "Jump", "value": "AAAAAQAAAAEAAAA7Aw==" },
        { "name": "Exit", "value": "AAAAAQAAAAEAAABjAw==" },
        { "name": "Tv", "value": "AAAAAQAAAAEAAAAkAw==" },
        { "name": "Input", "value": "AAAAAQAAAAEAAAAlAw==" },
        { "name": "TvInput", "value": "AAAAAQAAAAEAAAAlAw==" },
        { "name": "Red", "value": "AAAAAgAAAJcAAAAlAw==" },
        { "name": "Green", "value": "AAAAAgAAAJcAAAAmAw==" },
        { "name": "Yellow", "value": "AAAAAgAAAJcAAAAnAw==" },
        { "name": "Blue", "value": "AAAAAgAAAJcAAAAkAw==" },
        { "name": "Teletext", "value": "AAAAAQAAAAEAAAA\/Aw==" },
        { "name": "Stop", "value": "AAAAAgAAAJcAAAAYAw==" },
        { "name": "Rewind", "value": "AAAAAgAAAJcAAAAbAw==" },
        { "name": "Forward", "value": "AAAAAgAAAJcAAAAcAw==" },
        { "name": "Prev", "value": "AAAAAgAAAJcAAAA8Aw==" },
        { "name": "Next", "value": "AAAAAgAAAJcAAAA9Aw==" },
        { "name": "Play", "value": "AAAAAgAAAJcAAAAaAw==" },
        { "name": "Rec", "value": "AAAAAgAAAJcAAAAgAw==" },
        { "name": "Pause", "value": "AAAAAgAAAJcAAAAZAw==" },
        { "name": "OneTouchView", "value": "AAAAAgAAABoAAABlAw==" },
        { "name": "GooglePlay", "value": "AAAAAgAAAMQAAABGAw==" },
        { "name": "Netflix", "value": "AAAAAgAAABoAAAB8Aw==" },
        { "name": "PartnerApp6", "value": "AAAAAwAACB8AAAAFAw==" },
        { "name": "PartnerApp5", "value": "AAAAAwAACB8AAAAEAw==" },
        { "name": "YouTube", "value": "AAAAAgAAAMQAAABHAw==" },
        { "name": "PartnerApp9", "value": "AAAAAwAACB8AAAAIAw==" },
        { "name": "PartnerApp7", "value": "AAAAAwAACB8AAAAGAw==" },
        { "name": "ActionMenu", "value": "AAAAAgAAAMQAAABLAw==" },
        { "name": "ApplicationLauncher", "value": "AAAAAgAAAMQAAAAqAw==" },
        { "name": "Help", "value": "AAAAAgAAAMQAAABNAw==" },
        {
          "name": "ShopRemoteControlForcedDynamic",
          "value": "AAAAAgAAAJcAAABqAw=="
        },
        { "name": "WakeUp", "value": "AAAAAQAAAAEAAAAuAw==" },
        { "name": "PowerOff", "value": "AAAAAQAAAAEAAAAvAw==" },
        { "name": "Sleep", "value": "AAAAAQAAAAEAAAAvAw==" },
        { "name": "Hdmi1", "value": "AAAAAgAAABoAAABaAw==" },
        { "name": "Hdmi2", "value": "AAAAAgAAABoAAABbAw==" },
        { "name": "Hdmi3", "value": "AAAAAgAAABoAAABcAw==" },
        { "name": "Options", "value": "AAAAAgAAAJcAAAA2Aw==" },
        { "name": "DpadCenter", "value": "AAAAAgAAAJcAAABKAw==" },
        { "name": "CursorLeft", "value": "AAAAAgAAAJcAAABNAw==" },
        { "name": "CursorRight", "value": "AAAAAgAAAJcAAABOAw==" },
        { "name": "CursorUp", "value": "AAAAAgAAAJcAAABPAw==" },
        { "name": "CursorDown", "value": "AAAAAgAAAJcAAABQAw==" },
        { "name": "DemoMode", "value": "AAAAAgAAAJcAAAB8Aw==" }
      ]
    ],
    "id": 1
  }
  ```

  

## Current Implementation

The `TvLaunchService` (`src/services/tv-launch-service.js`) currently handles:
- Power on/off via `wake()` and `standBy()` methods
- Application listing via `listApps()` method
- App launching via `launchApp()` method

All these methods follow the same pattern:
1. Read TV launch profile (hostname, preSharedKey, etc.)
2. Use `httpClient.post()` to make POST requests to `/sony/system` or `/sony/appControl`
3. Pass the Sony Bravia payload structure: `{ version: '1.0', id: 1, params: [] }`
4. Include `X-Auth-PSK` header if preSharedKey is configured

The `HttpClient` (`src/clients/http-client.js`) provides a simple wrapper around Node's native `http.request` for making POST requests.



## Required Changes

### File: `src/services/tv-launch-service.js`

Add a new method `getRemoteControllerInfo()` that fetches the TV control map. Use the `switch (tvType)` pattern consistent with `wake`, `standBy`, `listApps`, and `launchApp`:

```javascript
const getRemoteControllerInfo = () =>
  tvLaunchProfile$.pipe(
    switchMap((tvLaunchProfile) => {
      const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

      switch (tvType) {
        case 'BRAVIA':
          const { preSharedKey } =
            /** @type BraviaLaunchProfile */ tvLaunchProfile;
          return httpClient.post(
            hostname,
            '/sony/system',
            {
              ...braviaPayloadBase,
              method: 'getRemoteControllerInfo',
            },
            preSharedKey && { 'X-Auth-PSK': preSharedKey }
          );
        default:
          return throwError(null);
      }
    }),
    catchError(() => of({})),
    take(1)
  );
```

Place the new method below `launchApp`:

```javascript
const launchApp = (uri) => ...
const getRemoteControllerInfo = ... // Add here
```

Add `getRemoteControllerInfo()` to the `forkJoin` in `wakeAndLaunchAppForBravia` and update the destructuring to include the third element:

```javascript
const wakeAndLaunchAppForBravia = () =>
  forkJoin(listApps(), getAppTitle(), getRemoteControllerInfo()).pipe(
    switchMap(([braviaResponse, appTitle, remoteControllerInfo]) => {
      console.log(remoteControllerInfo);
      // ... rest unchanged
    }),
  );
```

The method does not need to be added to the module's return object — it is only used internally by `wakeAndLaunchAppForBravia`.





## Expected API Response

Based on the user's test, the response structure will be:

```json
{
  "result": [
    { "bundled": true, "type": "RMF-TX500" },
    [
      { "name": "Home", "value": "AAAEA..." },
      { "name": "VolumeUp", "value": "AAAEA..." },
      // ... more buttons
    ]
  ],
  "id": 1
}
```

The key information needed is the second element of `result[1]` - an array of button mappings with `name` and `value` properties.

### File: `typedef.js`

Add typedefs for the remote controller info response:

```javascript
/**
 * @typedef {Object} BraviaRemoteControllerButton
 * @property {string} name
 * @property {string} value
 */

/**
 * @typedef {Object} BraviaRemoteControllerMeta
 * @property {boolean} bundled
 * @property {string} type
 */
```



## Files Modified

- `src/services/tv-launch-service.js` - Add `getRemoteControllerInfo()` method (internal only, not exported)
- `typedef.js` - Add `BraviaRemoteControllerButton` and `BraviaRemoteControllerMeta` typedefs
