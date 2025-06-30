# Install Redis-Server
```shell
sudo apt install redis-server- y
```

## Start server
```shell
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

## Config server
```shell
sudo nano /etc/redis/redis.conf
```
```TOML
bind 127.0.0.1 a bind 0.0.0.0
# requirepass foobared change
requirepass "passwordSecure"
masteruser "username"
```
```shell
sudo systemctl restart redis-server
```
### or create new user
```shell
redis-cli
127.0.0.1>AUTH "passwordSecure"
OK
127.0.0.1>ping
PONG
127.0.0.1>ACL SETUSER "username" ON >"securePassword" ~* +@all
OK
127.0.0.1>SAVE
OK
127.0.0.1>AUTH default "securePassword"
Ok
127.0.0.1>AUTH "username" "securePassword"
Ok
```

## Activate public
```shell
sudo firewall-cmd --add-port=6379/tcp --zone=public --permanent
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

