## Description

[*MPD*](https://www.musicpd.org/) is a lean, powerful headless music player. There are numerous clients in many different form factors ref: [link](https://www.musicpd.org/clients/).



The aim of the `mpd-avr-client` project is to explore the practicality of using an AV Receiver as a client for *MPD*. This project is built using

- a *Raspberry Pi 3* for development
- a *Yamaha RX-V385* for testing
  - a *Raspberry Pi Zero* is used for testing
  - the *Raspberry Pi* is the only device connected to the *AVR* via *HDMI*
- a *VMA317* Infrared Receiver breakout board




The objectives of the project are to use

- the *AVR* infrared remote control as input
- the *AVR* built-in display to feature *MPD* status and playlist selection
- the *AVR* connected speakers to output sound





# Prerequisites

`mpd` - a headless music player

`mpc` - a terminal client for `mpd`, it is used for subscribing to `mpd` events

`cec-client` - a *TTY* application used for subscribing to *CEC* events and sending commands to the *AVR*

`gatttool` - an application used for Bluetooth communication with smart LED strips

`ir-keytable` - an application used for configuring IR protocol support

`evtest` - a *TTY* application used for infrared input event testing



Follow this [link](https://github.com/kdha200501/mpd-avr-client/blob/master/trixie.md) to see a setup guide on Trixie



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






##### Launch on startup

```shell
$ sudo touch /etc/systemd/system/mpd-avr-client.service
$ sudo vim /etc/systemd/system/mpd-avr-client.service
```

Copy and paste:

```shell
[Unit]
Description=MPD AVR Client Service
After=network.target

[Service]
Type=simple

# Enable all IR protocols
ExecStartPre=/usr/bin/ir-keytable -p all

# We source nvm.sh to ensure the environment is ready, then launch the app with its flags
ExecStart=/bin/bash -c 'export NVM_DIR="/home/pi/.nvm" && . $NVM_DIR/nvm.sh && mpd-avr-client -v 38 -t "tx 15:44:69:09" -T 48 -b /home/pi/.mpd-avr-client/bravia-launch-profile.json -r /dev/input/event0 -R /home/pi/.mpd-avr-client/yamaha-bravia-mapping.json -g /home/pi/.mpd-avr-client/govee-launch-profile.json'

Restart=always
RestartSec=5

# Logs go to journalctl -u mpd-avr-client
StandardOutput=inherit
StandardError=inherit

[Install]
WantedBy=multi-user.target
```

install service

```shell
$ sudo systemctl daemon-reload

$ sudo systemctl enable mpd-avr-client
$ sudo systemctl start mpd-avr-client
$ sudo systemctl status mpd-avr-client
```







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



Since this setup cuts off communication between the *AVR* and the *TV*, `mpd-avr-client` provides a solution to relay *AVR* remove control key press to the *TV*. The solution converts the `lirc` values captured by the infrared receiver breakout board into `ircc` code and send the code to the *TV*.



To create a remote control mapping

```shell
$ mpd-avr-client map-keys -r <ir-receiver-path> -b <bravia-launch-profile.json> -C <output-file-directory>
```

> [!TIP]
>
> run `evtest` to figure out the path to the infrared receiver
>
> see [`commands/map-keys.md`](https://github.com/kdha200501/mpd-avr-client/blob/master/commands/map-keys.md) for details



The *Bravia* *TV* launch profile is supplied under the `-b` option and the remote control mapping is supplied under the `-R` option. See [`commands/main.md`](https://github.com/kdha200501/mpd-avr-client/blob/master/commands/main.md) for examples.

> [!TIP]
>
> the `-t` option is required when using the `-b`  option and the `-R` option







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



The *Govee* *LED* launch profile is supplied under the `-g` option. See [`commands/main.md`](https://github.com/kdha200501/mpd-avr-client/blob/master/commands/main.md) for examples.

> [!TIP]
>
> the `-t` option is required when using the `-g`  option
