# Plan: Relay CEC Key Events to Bravia TV via IRCC

## Context

When the AVR hands over audio to the TV (blue button → `AvrAudioSourceSwitchReducer`), remote control CEC key events should be relayed to the Sony Bravia TV as IRCC HTTP commands. This builds on step-1 which fetches the remote controller info (IRCC map) during `wakeAndLaunchAppForBravia`.

## Current Architecture

- **CEC key events** arrive via `cecClient.publisher()` and flow into `AppStateReducer.onRemoteControlKeyup`
- **TV mode activation** happens in `AvrAudioSourceSwitchReducer.switchingAudioSource()` (blue button press → audio handed to TV)
- **TV mode deactivation** happens when the AVR goes to standby (detected in the same reducer)
- **IRCC map** will be fetched in `TvLaunchService.wakeAndLaunchAppForBravia()` (step-1)
- **No persistent "TV mode" state** currently exists — the app doesn't track whether audio is currently routed to TV

### Remote Control Event Handling

Remote control event processing happens in `src/reducers/app-state-reducer.js` in the `onRemoteControlKeyup` function. Each remote button press is represented as CEC transmission data with hex codes like `51:44:xx` where `xx` is the button code.

### Application Flow

1. **Entry point**: `cli.js` → `commands/main.js`
2. **Event streams**: CEC events from `cecClient` and MPD events from `mpClient`
3. **State reducer**: `AppStateReducer` processes events and returns updated `AppState`
4. **UI updates**: `AppStateRenderer` and `PromptRenderer` display on the AVR's OSD

### Current CEC Key Mappings (from `const.js`)

| CEC Hex Code | RegExp Constant | Button |
|---|---|---|
| `51:44:02` | `arrowUpKeyupRegExp` | Arrow Up |
| `51:44:01` | `arrowDownKeyupRegExp` | Arrow Down |
| `51:44:00` | `enterKeyupRegExp` | Enter |
| `51:44:0d` | `returnKeyupRegExp` | Return |
| `51:44:44` | `playKeyupRegExp` | Play |
| `51:44:46` | `pauseKeyupRegExp` | Pause |
| `51:44:45` | `stopKeyupRegExp` | Stop |
| `51:44:4b` | `nextKeyupRegExp` | Next |
| `51:44:4c` | `previousKeyupRegExp` | Previous |
| `51:44:72` | `redFunctionKeyupRegExp` | Red |
| `51:44:73` | `greenFunctionKeyupRegExp` | Green |
| `51:44:74` | `yellowFunctionKeyupRegExp` | Yellow |
| `51:44:71` | `blueFunctionKeyupRegExp` | Blue |

## Where to Implement

The relay should be implemented **inside the `if (fromMpStatusState && toMpStatusState)` block** in `AvrAudioSourceSwitchReducer` (`src/reducers/avr-audio-source-switch-reducer.js`, line 122). This condition is true once the audio switch sequence completes (TV mode), and remains true until AVR standby resets the reducer.

TV mode is intentionally separate from main `AppState` — once audio is handed to the TV, there is no CEC-based mechanism to switch back. The reducer already receives CEC events and already performs side effects (e.g., `tvLaunchService.wakeAndLaunchApp().subscribe()`). Handling key relay here:

1. Keeps TV mode state contained in `AvrAudioSourceSwitchReducer`
2. Avoids adding `isTvMode` to `AppState` or modifying `AppStateReducer`
3. No new subscriber or wiring in `main.js` needed

When `fromMpStatusState && toMpStatusState` is true and a CEC key event arrives:
1. Extract the CEC hex code from the transmission
2. Map it to an IRCC button name via `cecToIrccButtonNameMap`
3. Call `tvLaunchService.sendIrcc(irccButtonName)`
4. Return `acc` (state unchanged — stay in TV mode)

## Implementation Sub-Steps

### 1. Add `sendIrcc(irccCode)` method to `TvLaunchService`

Send an IRCC command to the TV. The Sony Bravia IRCC endpoint accepts an XML body:

```
POST /sony/IRCC
Content-Type: text/xml; charset=UTF-8
X-Auth-PSK: <key>
SOAPACTION: "urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"

<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
      <IRCCCode>{base64_value}</IRCCCode>
    </u:X_SendIRCC>
  </s:Body>
</s:Envelope>
```

This requires extending `HttpClient` with a raw/XML POST variant, since the current `httpClient.post()` only sends JSON.

### 2. Store the IRCC map from step-1 in `TvLaunchService`

After `getRemoteControllerInfo()` resolves in `wakeAndLaunchAppForBravia`, store the button array as a `Map<string, string>` (name → base64 value) on the service instance so `sendIrcc` can look up by button name.

### 3. Create a CEC-to-IRCC button name mapping

Map CEC hex codes (from `const.js`) to Bravia IRCC button names (from the remote controller info response):

| CEC Hex | CEC Button | IRCC Name |
|---|---|---|
| `51:44:02` | Arrow Up | `Up` |
| `51:44:01` | Arrow Down | `Down` |
| `51:44:00` | Enter | `Confirm` |
| `51:44:0d` | Return | `Return` |
| `51:44:44` | Play | `Play` |
| `51:44:46` | Pause | `Pause` |
| `51:44:45` | Stop | `Stop` |
| `51:44:4b` | Next | `Next` |
| `51:44:4c` | Previous | `Prev` |
| `51:44:72` | Red | `Red` |
| `51:44:73` | Green | `Green` |
| `51:44:74` | Yellow | `Yellow` |
| `51:44:71` | Blue | `Blue` |

This can be a constant map in `const.js` or a dedicated mapping file.

### 4. Add IRCC relay in `AvrAudioSourceSwitchReducer`'s TV mode block

In the existing `if (fromMpStatusState && toMpStatusState)` block (line 122):
- Extract the CEC hex code from `cecClientEvent.data` using a regex (e.g., capturing `51:44:xx`)
- Look up the IRCC button name via `cecToIrccButtonNameMap`
- If found: call `tvLaunchService.sendIrcc(irccButtonName).subscribe()`
- Return `acc` (stay in TV mode)

### 5. ~~Add IRCC relay logic in `AppStateReducer`~~ (not needed)

TV mode is handled entirely in `AvrAudioSourceSwitchReducer`. No changes to `AppStateReducer` required.

## Dependencies

- Step 1 (`getRemoteControllerInfo`) must be implemented first — it provides the IRCC map
- `HttpClient` needs an XML POST capability (or a separate method for IRCC)

## Files to Modify

- `src/clients/http-client.js` — Add XML POST method for IRCC
- `src/services/tv-launch-service.js` — Add `sendIrcc()`, store IRCC map, export new method
- `const.js` — Add CEC hex → IRCC button name mapping, add regex for extracting CEC hex code
- `typedef.js` — Add `BraviaRemoteControllerButton` typedef
- `src/reducers/avr-audio-source-switch-reducer.js` — Add IRCC relay in the TV mode `if` block
