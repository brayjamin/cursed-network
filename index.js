"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeResponse = exports.sql = exports.fn = exports.Server = exports.Client = exports.Protocol = exports.Port = exports.Proxy = exports.encode = exports.decode = exports.register = exports.thisClient = void 0;
const stdlib_paper_1 = require("@grakkit/stdlib-paper");
const socket_1 = require("@grakkit/socket");
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return socket_1.Client; } });
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return socket_1.Server; } });
function decode(content) {
    let index = 0;
    let string = '';
    let extra1, extra2;
    while (index < content.length) {
        let char = content[index++];
        switch (char >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                string += String.fromCharCode(char);
                break;
            case 12:
            case 13:
                extra1 = content[index++];
                string += String.fromCharCode(((char & 0x1f) << 6) | (extra1 & 0x3f));
                break;
            case 14:
                extra1 = content[index++];
                extra2 = content[index++];
                string += String.fromCharCode(((char & 0x0f) << 12) | ((extra1 & 0x3f) << 6) | ((extra2 & 0x3f) << 0));
                break;
        }
    }
    return string;
}
exports.decode = decode;
function encode(content) {
    let index = 0;
    const array = new Uint8Array(content.length);
    while (index < content.length) {
        array[index] = content.charCodeAt(index++);
    }
    return array;
}
exports.encode = encode;
let Proxy;
exports.Proxy = Proxy;
let Port;
exports.Port = Port;
let NodeType;
let NodeName;
let Driver;
let sql;
exports.sql = sql;
const insertAt = (str, sub, pos) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
setImmediate(() => {
    if (stdlib_paper_1.manager.getPlugin('MySQL').isEnabled()) {
        //@ts-expect-error
        Driver = (0, stdlib_paper_1.type)('com.mysql.cj.jdbc.Driver');
        new Driver();
        //@ts-expect-error
        exports.sql = sql = (0, stdlib_paper_1.type)('me.vagdedes.mysql.database.MySQL');
        try {
            sql.disconnect();
        }
        catch (e) { }
        sql.connect();
        console.info(`[grakkit] §dCursed Network §f« » §3MySQL §aSUCCESS`);
    }
    else
        console.info(`[grakkit] §dCursed Network §f« » §3MySQL §cFAILURE§r! Is MySQL plugin present and enabled?`);
});
const UUID = (0, stdlib_paper_1.type)('java.util.UUID');
const thisClient = new socket_1.Client();
exports.thisClient = thisClient;
function register(type, port, NodeName) {
    exports.Port = Port = port;
    NodeType = type;
    NodeName = NodeName;
    switch (type) {
        case 'server': {
            exports.Proxy = Proxy = new socket_1.Server();
            Proxy.start(port);
            try {
                thisClient.connect(port);
            }
            catch (e) {
                console.error(e);
            }
            break;
        }
        case 'client': {
            try {
                thisClient.connect(port);
            }
            catch (e) {
                console.error(e);
            }
            break;
        }
    }
    console.info('[grakkit] §dCursed Network §rinit §aSUCCESS');
    console.info(`§fNode: §3${NodeType}§r §fPort: §3${Port}§r`);
    /* Register Proxy Listeners */
    Proxy.on('data', ({ client, data }) => {
        const metadata = JSON.parse(decode(data));
        const Data = metadata.params;
        const protocol = metadata.protocol;
        if (typeof protocol == 'undefined')
            return;
        switch (protocol) {
            case 'SEND_MESSAGE': {
                if (typeof Data.uuid != 'undefined' && typeof Data.message != 'undefined') {
                    //@ts-expect-error
                    const player = server.getOfflinePlayer(UUID.fromString(Data.uuid));
                    if (player.isOnline())
                        player.getPlayer().sendMessage(Data.message);
                }
                break;
            }
            /*case 'DISPATCH_PARTY_REQUEST': {
               if (typeof Data.sender != 'undefined' && typeof Data.target != 'undefined') {
                  ////@ts-expect-error
                  const target = server.getOfflinePlayer(UUID.fromString(Data.target));
                  if (!target.isOnline()) return;
                  ////@ts-expect-error
                  const sender = server.getOfflinePlayer(UUID.fromString(Data.sender));
                  break;
               }
            }*/
        }
    });
}
exports.register = register;
function serializeRow(response, columns) {
    const row = {};
    for (let i = 0; typeof columns[i] != 'undefined'; i++) {
        row[columns[i]] = response.getString(columns[i]);
    }
    return row;
}
function serializeResponse(response, columns) {
    const arrResponse = [];
    let i = 0;
    if (response == null)
        return [];
    if (!response.next())
        return [];
    for (let result = true; result; result = response.next()) {
        arrResponse[i++] = serializeRow(response, columns);
    }
    return arrResponse;
}
exports.serializeResponse = serializeResponse;
function justify(...array) {
    return array.join(' ');
}
const fn = {
    getPendingRequestsSent(friender_id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE '${friender_id}' IN (friender_id) AND friend.id <> '${friender_id}'`, `AND accepted_at IS null AND blocked_at IS null;`)), ['friendee_id', 'created_at']);
    },
    getPendingRequestsReceived(friendee_id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id`, `WHERE friendee_id = '${friendee_id}'`, `AND accepted_at IS null and blocked_at IS null`)), ['friender_id', 'created_at']);
    },
    getFriends(id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE '${id}' IN (friendee_id, friender_id) AND friend.id <> '${id}'`, `AND accepted_at IS NOT null AND blocked_at IS null;`)), ['id', 'name', 'created_at', 'accepted_at']);
    },
    removeFriend(friender_id, friendee_id) {
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        // if friends
        const q = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS NOT null AND blocked_at IS null`);
        if (q != null && q.next() && q.getString('accepted_at') != null) {
            // remove friend
            return sql.update(justify(`DELETE FROM friendships`, `WHERE friender_id = '${friender_id}' AND friendee_id = '${friendee_id}'`));
        }
        else
            return 'NOT_FRIENDS';
    },
    userExists(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('id') != null)
            return true;
        return false;
    },
    addFriend(friender_id, friendee_id) {
        /* If a friend request exists */
        if (!fn.userExists(friender_id))
            return 'FRIENDER_ID_INVALID';
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        const q = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS null;`);
        if (q != null && q.next())
            if (!sql.update(justify('UPDATE friendships', 'SET accepted_at = now()', `WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}'`, `AND accepted_at IS null`)))
                /* add as a friend */
                return sql.update(justify('UPDATE friendships', 'SET accepted_at = now()', `WHERE friendee_id = '${friender_id}' AND friender_id = '${friendee_id}'`, `AND accepted_at IS null`));
            else
                return true;
        else {
            const q2 = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS NOT null;`);
            if (q2 != null && q2.next())
                return 'ALREADY_FRIEND';
            else
                return 'REQUEST_NOT_ACTIVE';
        }
    },
    sendFriendRequest(friender_id, friendee_id) {
        /* If a friend request exists */
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        if (sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`) != null &&
            sql
                .query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`)
                .next())
            return 'ALREADY_SENT';
        else if (sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`) != null &&
            sql
                .query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`)
                .next())
            return 'ALREADY_FRIEND';
        else
            return sql.update(justify(`INSERT INTO friendships (friender_id, friendee_id) VALUES ('${friender_id}', '${friendee_id}');`));
    },
    getNameFromUuid(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}';`);
        const empty = !q.next();
        if (q != null && !empty && q.getString('name') != null)
            return q.getString('name');
        const name = (0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`).json().name;
        if (empty && q.getString('id') == null)
            sql.update(`INSERT INTO users (id, name, server) VALUES ('${id}', '${name}', '${NodeName}')`);
        else
            sql.update(`UPDATE users SET name = '${name}' WHERE id = '${id}';`);
        return name;
    },
    getUuidFromName(name) {
        const request = (0, stdlib_paper_1.fetch)(`https://api.mojang.com/users/profiles/minecraft/${name}`);
        try {
            let id = request.json().id;
            id = insertAt(id, '-', 8);
            id = insertAt(id, '-', 13);
            id = insertAt(id, '-', 18);
            id = insertAt(id, '-', 23);
            return id;
        }
        catch (e) {
            return null;
        }
    },
    addUser(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('id') != null)
            return 'ALREADY_EXISTS';
        return sql.update(`INSERT INTO users (id, name, server) VALUES ('${id}', '${(0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/` + id).json().name}', '${NodeName}');`);
    },
    getServer(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('server') != null)
            return q.getString('server');
        return null;
    },
    setServer(id, server) {
        return sql.update(`UPDATE users SET server = '${server}' WHERE id = '${id}'`);
    }
};
exports.fn = fn;
function Protocol(protocol, params) {
    thisClient.send(encode(JSON.stringify({ protocol: protocol, params })));
}
exports.Protocol = Protocol;
function filter(suggestions, key) {
    return suggestions.filter(word => {
        return word.toLowerCase().includes(key.toLowerCase());
    });
}
function sendFriendList(player) {
    const friends = fn.getFriends(player.getUniqueId().toString());
    if (friends.length === 0)
        return player.sendMessage('You have no friends');
    const names = [];
    let i = names.length;
    friends.forEach(friend => {
        //@ts-expect-error
        if (friend.name != null)
            names[i] = friend.name;
        else {
            //@ts-expect-error
            const q = sql.query(`SELECT * FROM users WHERE id = '${friend.id}';`);
            if (q != null && q.next() && q.getString('name') != null)
                names[i] = q.getString('name');
            else {
                names[i] = (0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/${q.getString('id')}`).json().name;
                //@ts-expect-error
                sql.update(`UPDATE users SET name = '${names[i]}' WHERE id = '${friend.id}';`);
            }
        }
        i++;
    });
    player.sendMessage(`Friends (${names.length}):`);
    names.forEach(n => {
        player.sendMessage(n);
    });
}
const feedback = {
    friends: {
        already_friend: 'You are already friends with this player!',
        friendee_id_invalid: 'This user does not exist!',
        already_sent: "You've already sent a friend request to this player!",
        not_friends: "You're already not friends with this player!",
        request_not_active: "You haven't received a friend request from this player!",
        friended_success: name => {
            return `You're now friends with ${name}!`;
        },
        success: name => {
            return 'A friend request has been sent to ' + name + '!';
        },
        remove_success: name => {
            return `${name} has been removed from your friends list.`;
        }
    }
};
(0, stdlib_paper_1.command)({
    name: 'friend',
    aliases: ['f', 'friends'],
    execute(player, ...args) {
        //@ts-expect-error
        const uuid = player.getUniqueId().toString();
        switch (args[0]) {
            case 'list': {
                sendFriendList(player);
                break;
            }
            case 'add': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.sendFriendRequest(uuid, fn.getUuidFromName(args[1]))) {
                    case 'ALREADY_FRIEND':
                        return player.sendMessage(feedback.friends.already_friend);
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(feedback.friends.friendee_id_invalid);
                    case 'ALREADY_SENT':
                        return player.sendMessage(feedback.friends.already_sent);
                    case true:
                        return player.sendMessage(feedback.friends.success(args[1]));
                    case false:
                        return player.sendMessage('you suck');
                    default:
                        return player.sendMessage('fuck');
                }
                break;
            }
            case 'remove': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.removeFriend(uuid, fn.getUuidFromName(args[1]))) {
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(feedback.friends.friendee_id_invalid);
                    case 'NOT_FRIENDS':
                        return player.sendMessage(feedback.friends.not_friends);
                    case true:
                        return player.sendMessage(feedback.friends.remove_success(args[1]));
                    default:
                        return player.sendMessage('fuck');
                }
            }
            case 'accept': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.addFriend(fn.getUuidFromName(args[1]), uuid)) {
                    case 'ALREADY_FRIEND':
                        return player.sendMessage(feedback.friends.already_friend);
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(feedback.friends.friendee_id_invalid);
                    case 'REQUEST_NOT_ACTIVE':
                        return player.sendMessage(feedback.friends.request_not_active);
                    case true:
                        return player.sendMessage(feedback.friends.friended_success(args[1]));
                }
            }
        }
    },
    tabComplete: (player, ...args) => {
        switch (args.length) {
            case 1:
                return filter(['list', 'add', 'remove', 'accept', 'deny', 'help', 'toggle'], args[0]);
        }
    }
});
(0, stdlib_paper_1.event)('org.bukkit.event.player.PlayerJoinEvent', {
    priority: 'HIGHEST',
    script: event => {
        const id = event.getPlayer().getUniqueId().toString();
        //if (fn.getServer(id) != null)
    }
});
