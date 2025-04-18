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

