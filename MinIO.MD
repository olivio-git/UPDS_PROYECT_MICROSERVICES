# MiniO Install
## Download
```shell
wget https://dl.min.io/server/minio/release/linux-amd64/minio
```

## Permission +X
```shell
chmod +x minio
```

## Move
```shell
sudo mv minio /usr/local/bin/
```

## Create Data
```shell
sudo mkdir -p /data/minio
sudo chown -R $USER:$USER /data/minio
```

## Execute Server
```shell
minio server /data/minio --console-address ":9001"
```


## Create service to systemd
```shell
sudo nano /etc/systemd/system/minio.service
```
```TOML
[Unit]
Description=MinIO
After=network.target

[Service]
User=root
Group=root
Environment="MINIO_ROOT_USER=admin-user-tag"
Environment="MINIO_ROOT_PASSWORD=password-secure-tag"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"

[Install]
WantedBy=multi-user.target
```

## Start and Enable services
```shell
sudo systemctl enable minio
sudo systemctl start minio
sudo systemctl status minio
```

## Open port to public
```shell
sudo firewall-cmd --list-ports
sudo firewall-cmd --add-port=9000/tcp --zone=public --permanent
sudo firewall-cmd --add-port=9001/tcp --zone=public --permanent
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

