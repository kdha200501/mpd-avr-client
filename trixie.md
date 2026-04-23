# Install `cec-client`

```shell
$ sudo apt update
$ sudo apt install cec-utils

$ echo scan | cec-client -s -d 1
```

##### Fix user group

```shell
$ sudo usermod -a -G video,audio,dialout pi
$ sudo reboot
```





# Enable Bluetooth

##### Check if Bluetooth is blocked

```shell
$ rfkill list
```

> [!TIP]
>
> To remove soft block
>
> ```shell
> $ sudo rfkill unblock bluetooth
> ```

##### Turn on Bluetooth

```shell
$ bluetoothctl
```

then run the following in the tty

```
power on
scan on
exit
```
##### Launch Bluetooth service at startup

```shell
$ sudo systemctl start bluetooth
$ sudo systemctl enable bluetooth
```





# Install `mpd`

```shell
$ sudo apt install mpd mpc
```

##### Configure sound output

```shell
$ aplay /usr/share/sounds/alsa/Front_Left.wav
$ aplay /usr/share/sounds/alsa/Front_Right.wav

$ sudo vim /etc/mpd.conf
```

Copy and paste

```shell
audio_output {
	type		"alsa"
	name		"My ALSA Device"
}
```

##### Launch media player service at startup

```shell
$ sudo systemctl enable mpd
$ sudo systemctl start mpd
```

##### Fix permission

```shell
$ chmod o+x /home/pi
$ sudo chmod -R 775 /var/lib/mpd/playlists
```

> [!WARNING]
>
> | **Digit** | **Who it applies to**      | **Permission Level** | **Meaning**                                         |
> | --------- | -------------------------- | -------------------- | --------------------------------------------------- |
> | **7**     | **Owner** (User)           | `rwx`                | Can read, write, and execute.                       |
> | **7**     | **Group**                  | `rwx`                | Can read, write, and execute.                       |
> | **5**     | **Others** (Everyone else) | `r-x`                | Can read and execute, but **cannot** modify/delete. |






# Install `nvm`

```shell
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
$ source ~/.bashrc
$ command -v nvm
```

> [!TIP]
>
> Use the unofficial mirror to avoid compiling node from source in 32-bit distros
>
> ```shell
> $ vim ~/.bashrc
> ```
>
> Add
>
> ```shell
> export NVM_NODEJS_ORG_MIRROR=https://unofficial-builds.nodejs.org/download/release
> ```
>
> Then
>
> ```shell
> $ source ~/.bashrc
> ```

##### Install node

```shell
$ nvm install --lts
```

> [!TIP]
>
> Or install a specific version *e.g.*
>
> ```shell
> $ nvm install 20
> $ which node
> ```



