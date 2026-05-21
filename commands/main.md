# Options

```shell
$ mpd-avr-client -h
```



```
  --version                                Show version number                             [boolean]
  --osdMaxLength, -o                       Specify the maximum number of characters that can be put
                                           on the OSD                         [number] [default: 14]
  --audioVolumePreset, -v                  Optionally set the audio volume (0-100) when the AVR
                                           wakes up. For Yamaha RX-V385, -42dB corresponds to 35.
                                                                                            [number]
  --handOverAudioToTvCecCommand, -t        Optionally provide the CEC command for the AVR to switch
                                           audio source to a TV that is connected via a non-HDMI
                                           input, e.g. `tx 15:44:69:09`. Use the blue button to
                                           switch audio source.                             [string]
  --audioVolumePresetForTv, -T             Optionally set the audio volume when the AVR switches
                                           audio source to TV                               [number]
  --infraredDevice, -r                     Optionally provide the path to an infrared receiver
                                           device, e.g. `/dev/input/event0`.                [string]
  --infraredRemoteControlMappingForTv, -R  Optionally provide the path to an infrared remote control
                                           kep mapping for the TV. Lirc key press is mapped to IRCC
                                           key press when the AVR switches audio source to a TV.
                                                                                            [string]
  --braviaLaunchProfile, -b                Optionally provide the path to a launch profile for Sony
                                           Bravia TV. This powers on TV when the AVR switches audio
                                           source to a TV.                                  [string]
  --goveeLaunchProfile, -g                 Optionally provide the path to a launch profile for Govee
                                           LED strip for TV. This powers on LEDs when the AVR
                                           switches audio source to a TV.                   [string]
  -h, --help                               Show help                                       [boolean]

Examples:
  cli.js -v 38
  cli.js -t "tx 15:44:69:09" -T 48 -b /home/pi/.mpd-avr-client/bravia-launch-profile.json -r
  /dev/input/event0 -R /home/pi/.mpd-avr-client/yamaha-bravia-mapping.json -g
  /home/pi/.mpd-avr-client/govee-launch-profile.json
```
