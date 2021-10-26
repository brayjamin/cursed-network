import { type, command, fetch, manager, event } from '@grakkit/stdlib-paper';
import { Client, Server } from '@grakkit/socket';
import * as _ from '@brayjamin/underscore';
function decode (content: Uint8Array) {
   let index = 0;
   let string = '';
   let extra1: number, extra2: number;
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
function encode (content: string) {
   let index = 0;
   const array = new Uint8Array(content.length);
   while (index < content.length) {
      array[index] = content.charCodeAt(index++);
   }
   return array;
}
type Proxy = Server;
let Proxy: Proxy;
let Port;
let NodeType;
let NodeName;
let Driver;
let sql;
type ResponseType =
   | 'USER_INVALID'
   | 'ALREADY_FRIEND'
   | 'ALREADY_SENT'
   | 'FRIENDER_ID INVALID'
   | 'FRIENDEE_ID INVALID'
   | 'NOT_FRIENDS'
   | 'ALREADY_EXISTS'
   | 'REQUEST_NOT_ACTIVE'
   | boolean;
const insertAt = (str: string, sub: string, pos: number): string => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
setImmediate(() => {
   if (manager.getPlugin('MySQL').isEnabled()) {
      //@ts-expect-error
      Driver = type('com.mysql.cj.jdbc.Driver');
      new Driver();
      //@ts-expect-error
      sql = type('me.vagdedes.mysql.database.MySQL');
      try {
         sql.disconnect();
      } catch (e) {}
      sql.connect();
      console.info(`[grakkit] §dCursed Network §f« » §3MySQL §aSUCCESS`);
   } else console.info(`[grakkit] §dCursed Network §f« » §3MySQL §cFAILURE§r! Is MySQL plugin present and enabled?`);
});
const UUID = type('java.util.UUID');
const thisClient = new Client();
type NodeType = 'server' | 'client';
function register (type: NodeType, port: number, name: string) {
   Port = port;
   NodeType = type;
   NodeName = name;
   switch (type) {
      case 'server': {
         Proxy = new Server();
         Proxy.start(port);
         try {
            thisClient.connect(port);
         } catch (e) {
            console.error(e);
         }
         break;
      }
      case 'client': {
         try {
            thisClient.connect(port);
         } catch (e) {
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
      if (typeof protocol == 'undefined') return;
      switch (protocol) {
         case 'SEND_MESSAGE': {
            if (typeof Data.uuid != 'undefined' && typeof Data.message != 'undefined') {
               //@ts-expect-error
               const player = server.getOfflinePlayer(UUID.fromString(Data.uuid));
               if (player.isOnline()) player.getPlayer().sendMessage(Data.message);
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
function serializeRow (response, columns) {
   const row = {};
   for (let i = 0; typeof columns[i] != 'undefined'; i++) {
      row[columns[i]] = response.getString(columns[i]);
   }
   return row;
}
function serializeResponse (response: any, columns: any) {
   const arrResponse = [];
   let i = 0;
   if (response == null) return [];
   if (!response.next()) return [];
   for (let result = true; result; result = response.next()) {
      arrResponse[i++] = serializeRow(response, columns);
   }
   return arrResponse;
}
function justify (...array: string[]) {
   return array.join(' ');
}
const fn = {
   getPendingRequestsSent (friender_id: string): object[] {
      return serializeResponse(
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
               `WHERE '${friender_id}' IN (friender_id) AND friend.id <> '${friender_id}'`,
               `AND accepted_at IS null AND blocked_at IS null;`
            )
         ),
         [ 'friendee_id', 'created_at' ]
      );
   },
   getPendingRequestsReceived (friendee_id: string): object[] {
      return serializeResponse(
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id`,
               `WHERE friendee_id = '${friendee_id}'`,
               `AND accepted_at IS null and blocked_at IS null`
            )
         ),
         [ 'friender_id', 'created_at' ]
      );
   },
   getFriends (id: string): object[] {
      return serializeResponse(
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
               `WHERE '${id}' IN (friendee_id, friender_id) AND friend.id <> '${id}'`,
               `AND accepted_at IS NOT null AND blocked_at IS null;`
            )
         ),
         [ 'id', 'name', 'created_at', 'accepted_at' ]
      );
   },
   removeFriend (friender_id, friendee_id): boolean | 'FRIENDEE_ID_INVALID' | 'NOT_FRIENDS' {
      if (!fn.userExists(friendee_id)) return 'FRIENDEE_ID_INVALID';
      // if friends
      const q = sql.query(
         justify(
            `SELECT * FROM users AS \`friend\``,
            `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
            `WHERE`,
            `('${friender_id}' in (friender_id) OR`,
            `'${friendee_id}' in (friender_id))`,
            `AND ('${friendee_id}' in (friendee_id)`,
            `OR '${friender_id}' in (friendee_id))`,
            `AND accepted_at IS NOT null`
         )
      );
      if (q != null && q.next() && q.getString('accepted_at') != null) {
         // remove friend
         return sql.update(
            justify(
               `DELETE FROM friendships`,
               `WHERE friender_id = '${friender_id}' AND friendee_id = '${friendee_id}' OR friender_id = '${friendee_id}' AND friendee_id = '${friender_id}'`
            )
         );
      } else return 'NOT_FRIENDS';
   },
   userExists (id): boolean {
      const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
      if (q != null && q.next() && q.getString('id') != null) return true;
      return false;
   },
   declineRequest (friender_id, friendee_id): boolean | 'FRIENDEE_ID_INVALID' {
      if (!fn.userExists(friendee_id)) return 'FRIENDEE_ID_INVALID';
      const q = sql.query(
         justify(
            `SELECT * FROM users AS \`friend\``,
            `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
            `WHERE`,
            `('${friender_id}' in (friender_id) OR`,
            `'${friendee_id}' in (friender_id))`,
            `AND ('${friendee_id}' in (friendee_id)`,
            `OR '${friender_id}' in (friendee_id))`,
            `AND accepted_at IS null AND blocked_at IS null;`
         )
      );
      if (q != null && q.next())
         return sql.update(
            justify(
               `DELETE FROM friendships`,
               `WHERE`,
               `('${friender_id}' in (friender_id) OR`,
               `'${friendee_id}' in (friender_id))`,
               `AND ('${friendee_id}' in (friendee_id)`,
               `OR '${friender_id}' in (friendee_id))`,
               `AND accepted_at IS null;`
            )
         );
      else return false;
   },
   addFriend (
      friender_id,
      friendee_id
   ): boolean | 'REQUEST_NOT_ACTIVE' | 'ALREADY_FRIEND' | 'FRIENDER_ID_INVALID' | 'FRIENDEE_ID_INVALID' {
      /* If a friend request exists */
      if (!fn.userExists(friender_id)) return 'FRIENDER_ID_INVALID';
      if (!fn.userExists(friendee_id)) return 'FRIENDEE_ID_INVALID';
      const q = sql.query(
         `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS null;`
      );
      if (q != null && q.next())
         if (
            !sql.update(
               justify(
                  'UPDATE friendships',
                  'SET accepted_at = now()',
                  `WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}'`,
                  `AND accepted_at IS null`
               )
            )
         )
            /* add as a friend */
            return sql.update(
               justify(
                  'UPDATE friendships',
                  'SET accepted_at = now()',
                  `WHERE friendee_id = '${friender_id}' AND friender_id = '${friendee_id}'`,
                  `AND accepted_at IS null`
               )
            );
         else return true;
      else {
         const q2 = sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS NOT null;`
         );
         if (q2 != null && q2.next()) return 'ALREADY_FRIEND';
         else return 'REQUEST_NOT_ACTIVE';
      }
   },
   test (friender_id, friendee_id) {
      return sql.query(
         justify(
            `SELECT * FROM users AS \`friend\``,
            `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
            `WHERE`,
            `('${friender_id}' in (friender_id) OR`,
            `'${friendee_id}' in (friender_id))`,
            `AND ('${friendee_id}' in (friendee_id)`,
            `OR '${friender_id}' in (friendee_id))`,
            `AND accepted_at IS null AND blocked_at IS null`
         )
      );
   },
   sendFriendRequest (
      friender_id,
      friendee_id
   ): boolean | 'AUTO_ACCEPTED' | 'ALREADY_SENT' | 'ALREADY_FRIEND' | 'FRIENDEE_ID_INVALID' {
      /* If a friend request exists */
      if (!fn.userExists(friendee_id)) return 'FRIENDEE_ID_INVALID';
      const q = sql.query(
         justify(
            `SELECT * FROM users AS \`friend\``,
            `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
            `WHERE`,
            `('${friender_id}' in (friender_id) OR`,
            `'${friendee_id}' in (friender_id))`,
            `AND ('${friendee_id}' in (friendee_id)`,
            `OR '${friender_id}' in (friendee_id))`,
            `AND accepted_at IS null AND blocked_at IS null`
         )
      );
      if (q != null && q.next()) {
         switch (q.getString('friender_id')) {
            case friender_id:
               return 'ALREADY_SENT';
            case friendee_id: {
               fn.addFriend(friendee_id, friender_id);
               return 'AUTO_ACCEPTED';
            }
         }
      } else {
         const q2 = sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
         );
         if (q2 != null && q2.next()) return 'ALREADY_FRIEND';
         else
            return sql.update(
               justify(
                  `INSERT INTO friendships (friender_id, friendee_id) VALUES ('${friender_id}', '${friendee_id}');`
               )
            );
      }
   },
   getNameFromUuid (id: string): string {
      const q = sql.query(`SELECT * FROM users WHERE id = '${id}';`);
      const empty = !q.next();
      if (q != null && !empty && q.getString('name') != null) return q.getString('name');
      const name = fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`).json().name;
      if (empty && q.getString('id') == null)
         sql.update(`INSERT INTO users (id, name, server) VALUES ('${id}', '${name}', '${NodeName}')`);
      else sql.update(`UPDATE users SET name = '${name}' WHERE id = '${id}';`);
      return name;
   },
   getUuidFromName (name: string) {
      const request = fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
      try {
         let id = request.json().id;
         id = insertAt(id, '-', 8);
         id = insertAt(id, '-', 13);
         id = insertAt(id, '-', 18);
         id = insertAt(id, '-', 23);
         return id;
      } catch (e) {
         return null;
      }
   },
   addUser (id: string): ResponseType {
      const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
      if (q != null && q.next() && q.getString('id') != null) return 'ALREADY_EXISTS';
      return sql.update(
         `INSERT INTO users (id, name, server) VALUES ('${id}', '${fetch(
            `https://sessionserver.mojang.com/session/minecraft/profile/` + id
         ).json().name}', '${NodeName}');`
      );
   },
   getServer (id: string): string | null {
      const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
      if (q != null && q.next() && q.getString('server') != null) return q.getString('server');
      return null;
   },
   setServer (id: string, server: string): boolean {
      return sql.update(`UPDATE users SET server = '${server}' WHERE id = '${id}'`);
   }
};
function Protocol (protocol: string, params: {}) {
   thisClient.send(encode(JSON.stringify({ protocol: protocol, params })));
}
function filter (suggestions: string[], key) {
   return suggestions.filter(word => {
      return word.toLowerCase().includes(key.toLowerCase());
   });
}
function sendFriendList (player) {
   const friends = fn.getFriends(player.getUniqueId().toString());
   if (friends.length === 0) return player.sendMessage('You have no friends');
   const names = [];
   let i = names.length;
   friends.forEach(friend => {
      //@ts-expect-error
      if (friend.name != null) names[i] = friend.name;
      else {
         //@ts-expect-error
         const q = sql.query(`SELECT * FROM users WHERE id = '${friend.id}';`);
         if (q != null && q.next() && q.getString('name') != null) names[i] = q.getString('name');
         else {
            names[i] = fetch(
               `https://sessionserver.mojang.com/session/minecraft/profile/${q.getString('id')}`
            ).json().name;
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
      args: [
         'help for /friend',
         ' ',
         '/f add <name> - send a friend request',
         '/f remove <name> - unfriend a player',
         '/f list - view all your friends',
         '/f accept <name> - accept a friend request',
         '/f deny <name> - decline a friend request',
         '/f | /f help - show this message'
      ],
      already_friend: 'You are already friends with this player!',
      friendee_id_invalid: 'This user does not exist!',
      already_sent: "You've already sent a friend request to this player!",
      not_friends: "You're already not friends with this player!",
      request_not_active: "You haven't received a friend request from this player!",
      declined_request: 'Friend request declined!',
      auto_success: name => {
         return `${name} already had an active friend request so they were automatically friended.`;
      },
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

command({
   name: 'friend',
   aliases: [ 'f', 'friends' ],
   execute (player, ...args) {
      //@ts-expect-error
      const uuid = player.getUniqueId().toString();
      switch (args[0]) {
         case 'list': {
            sendFriendList(player);
            break;
         }
         case 'add': {
            if (typeof args[1] == 'undefined') return;
            switch (fn.sendFriendRequest(uuid, fn.getUuidFromName(args[1]))) {
               case 'ALREADY_FRIEND':
                  return player.sendMessage(feedback.friends.already_friend);
               case 'FRIENDEE_ID_INVALID':
                  return player.sendMessage(feedback.friends.friendee_id_invalid);
               case 'ALREADY_SENT':
                  return player.sendMessage(feedback.friends.already_sent);
               case 'AUTO_ACCEPTED':
                  return player.sendMessage(feedback.friends.auto_success(args[1]));
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
            if (typeof args[1] == 'undefined') return;
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
         case 'deny': {
            if (typeof args[1] == 'undefined') return;
            switch (fn.declineRequest(uuid, fn.getUuidFromName(args[1]))) {
               case 'FRIENDEE_ID_INVALID':
                  return player.sendMessage(feedback.friends.friendee_id_invalid);
               case true:
                  return player.sendMessage(feedback.friends.declined_request);
            }
         }
         case 'accept': {
            if (typeof args[1] == 'undefined') return;
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
         default: {
            feedback.friends.args.forEach(a => {
               player.sendMessage(a);
            });
            break;
         }
      }
   },
   tabComplete: (player, ...args) => {
      switch (args.length) {
         case 1:
            return filter([ 'list', 'add', 'remove', 'accept', 'deny', 'help', 'toggle' ], args[0]);
      }
   }
});
event('org.bukkit.event.player.PlayerJoinEvent', {
   priority: 'HIGHEST',
   script: event => {
      const id = event.getPlayer().getUniqueId().toString();
      if (!fn.userExists(id)) fn.addUser(id);
      //if (fn.getServer(id) != null)
   }
});
export { thisClient, register, decode, encode, Proxy, Port, Protocol, Client, Server, fn, sql, serializeResponse };
