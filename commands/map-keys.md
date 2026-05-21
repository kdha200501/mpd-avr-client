# Options

```shell
$ mpd-avr-client map-keys -h
```



```
  --version                  Show version number                                           [boolean]
  -C, --directory            Specify the working directory
                                           [string] [default: "/home/jacks/projects/mpd-avr-client"]
  --infraredDevice, -r       Provide the path to an infrared receiver device, e.g.
                             `/dev/input/event0`.                                [string] [required]
  --braviaLaunchProfile, -b  Provide the path to a launch profile for Sony Bravia TV when mapping
                             remote control buttons to IRCC events                          [string]
  -h, --help                 Show help                                                     [boolean]

Examples:
  cli.js map-keys -r /dev/input/event0 -b ~/.mpd-avr-client/bravia-launch-profile.json -C
  ~/.mpd-avr-client
```
