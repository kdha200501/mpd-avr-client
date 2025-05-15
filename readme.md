## Description

[*MPD*](https://www.musicpd.org/) is a lean, powerful headless music player. There are numerous clients in many different form factors ref: [link](https://www.musicpd.org/clients/).



The aim of the `mpd-avr-client` project is to explore the practicality of using an AV Receiver as a client for *MPD*. This project is built using

- a *Raspberry Pi 3* for development
- a *Yamaha RX-V385* for testing
  - the *Raspberry Pi* is the only device connected to the *AVR* via *HDMI*




The objectives of the project is to use

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
                                     profile for Sony Bravia TV         [string]
  -h, --help                         Show help                         [boolean]
```





# Smart TV integration

The `mpd-avr-client` project is setup to avoid having *TV*(s) connected to *HDMI* ports of the *AVR*. This setup cuts off communication between the *AVR* and the *TV* to avoid unwanted propitiatory behaviours that are baked into these devices and give rise to unpleasant surprises. However, some traits bring convenience and those shall be re-implemented.



As an experiment, the `mpd-avr-client` project seeks to bring back convenience of powering on *TV*  (and putting *TV* in standby) by integrating with the *Bravia* *API*.



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



Also follow this [link](https://github.com/kdha200501/mpd-avr-client/blob/master/daemon.md) to see example
