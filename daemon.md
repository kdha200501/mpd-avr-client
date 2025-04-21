# Start `mpd-avr-client` on startup

##### Create a daemon

```shell
$ sudo vim /etc/systemd/system/mpd-avr-client.service
```



Copy and paste:

```shell
[Unit]
Description=AVR as a MPD client
After=network.target

[Service]
ExecStart=/usr/local/bin/mpd-avr-client
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```



Install the daemon

```shell
$ sudo systemctl daemon-reload
```



Verify the daemon

```shell
$ sudo systemctl start mpd-avr-client.service
$ sudo systemctl status mpd-avr-client.service
```





##### Run daemon at startup

```shell
$ sudo systemctl enable mpd-avr-client.service
```