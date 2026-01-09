## Description

[*MPD*](https://www.musicpd.org/) is a lean, powerful headless music player. There are numerous clients in many different form factors ref: [link](https://www.musicpd.org/clients/).



The aim of the `mpd-avr-client` project is to explore the practicality of using an AV Receiver as a client for *MPD*. This project is built using

- a *Raspberry Pi 3* for development
- a *Yamaha RX-V385* for testing
  - the *Raspberry Pi* is the only device connected to the *AVR* via *HDMI*




The objectives of the project are to use

- the *AVR* infrared remote control as input
- the *AVR* built-in display to feature *MPD* status and playlist selection
- the *AVR* connected speakers to output sound





# Prerequisites

`mpd` - a headless music player

`mpc` - a terminal client for `mpd`, it is used for subscribing to `mpd` events

`nc` - *Netcat*, a *TTY* application used for sending commands to `mpd`

`cec-client` - a *TTY* application used for subscribing to *CEC* events and sending commands to the *AVR*





# Usage

##### Installation

```shell
$ npm i -g mpd-avr-client
```



##### Figure out where to put music

```shell
$ cat /etc/mpd.conf | grep music_directory
```

> [!TIP]
>
> The configuration looks like this:
>
> ```
> music_directory                 "/var/lib/mpd/music"
> ```



##### Add a playlist to the music directory

```shell
$ sudo mkdir "/var/lib/mpd/music/playlist 1"
$ cd "/var/lib/mpd/music/playlist 1"
$ sudo ln -s "/path/to/song/file" ./
```



##### Launch

```shell
$ sudo mpd-avr-client
```

> [!WARNING]
>
> `mpd-avr-client` manages the `playlist_directory`, please backup the directory



##### Options

```
  --version                          Show version number               [boolean]
  -o, --osdMaxLength                 Specify the maximum number of characters
                                     that can be put on the OSD
                                                          [number] [default: 14]
  -v, --audioVolumePreset            Optionally set the audio volume when the
                                     AVR wakes up. Conversion from gain level to
                                     volume level can vary depending on the
                                     model. For Yamaha RX-V385, -43dB is 38.
                                                                        [number]
  -t, --handOverAudioToTvCecCommand  Optionally provide the CEC command for the
                                     AVR to switch audio source to a TV that is
                                     connected via a non-HDMI input, e.g. `tx
                                     15:44:69:09`. Use the blue button to switch
                                     audio source.                      [string]
  -T, --audioVolumePresetForTv       Optionally set the audio volume when the
                                     AVR switches audio source to TV    [number]
  -b, --braviaLaunchProfile          Optionally provide the path to a launch
                                     profile for Sony Bravia TV. This powers on
                                     TV when the AVR switches audio source to a
                                     TV.                                [string]
  -g, --goveeLaunchProfile           Optionally provide the path to a launch
                                     profile for Govee LED strip for TV. This
                                     powers on LEDs when the AVR switches audio
                                     source to a TV.                    [string]
  -h, --help                         Show help                         [boolean]
```



##### Launch on boot

Follow this [link](https://github.com/kdha200501/mpd-avr-client/blob/master/daemon.md) to see an example





# Smart TV integration

The `mpd-avr-client` project is setup to avoid having *TV*(s) connected to *HDMI* ports of the *AVR*. This setup cuts off communication between the *AVR* and the *TV* to avoid unwanted propitiatory behaviours that are baked into these devices and give rise to unpleasant surprises at runtime. However, some traits bring convenience and those shall be re-implemented.



As an experiment, the `mpd-avr-client` project integrates with the *Bravia* *API* to

- bring back the automation of powering on *TV*  (and putting *TV* in standby), and
- provide the convenience of launching an Application on the TV (as an option)



This experimental integration can be enabled by creating a *TV* launch profile and referencing the profile through the `-b` option *e.g.*

```shell
$ touch ~/.mpd-avr-client/bravia-launch-profile.json
$ vim ~/.mpd-avr-client/bravia-launch-profile.json
```

copy + paste:

```json
{
  "hostname": "<bravia__ip-address>",
  "preSharedKey": "<bravia__pre-shared-key--if-configured>",
  "appTitle": "e.g. Kodi"
}
```

> [!TIP]
>
> `-t` option is required, and optionally use a *Flirc* to control *TV* with the *AVR* remote-control





# Smart LED strip for TV integration
As an experiment, the `mpd-avr-client` project integrates with *Govee* through *Bluetooth* to automate the power cycle of LED light strip



This experimental integration can be enabled by creating an *LED* launch profile and referencing the profile through the `-g` option *e.g.*

```shell
$ touch ~/.mpd-avr-client/govee-launch-profile.json
$ vim ~/.mpd-avr-client/govee-launch-profile.json
```

copy + paste:

```json
{
  "macAddress": "<govee__mac-address>",
  "rowNumberHex": "<power__row-number>"
}
```

> [!NOTE]
>
> The *Bluetooth* MAC address can be found by listing *Bluetooth* devices with this command:
> ```shell
> $ sudo hcitool lescan
> ```
>
> The row number is the memory location for sending power management commands and it's typically `0x0014` for *Govee*. Use this command to list all row numbers:
>
> ``` shell
> $ sudo gatttool -t random -b <govee-bluetooth-mac-address> --characteristics
> ```
>
> 

> [!TIP]
>
> `-t` option is required

