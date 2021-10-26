"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundViewer = void 0;
const stdlib_paper_1 = require("@grakkit/stdlib-paper");
const Sound = (0, stdlib_paper_1.type)('org.bukkit.Sound');
const ItemStack = (0, stdlib_paper_1.type)('org.bukkit.inventory.ItemStack');
const NamespacedKey = (0, stdlib_paper_1.type)('org.bukkit.NamespacedKey');
const PersistentDataType = (0, stdlib_paper_1.type)('org.bukkit.persistence.PersistentDataType');
const Material = (0, stdlib_paper_1.type)('org.bukkit.Material');
const MAX_INVENTORY_COL = 9;
const soundKeys = Object.keys(Sound);
const materialKeys = Object.keys(Material);
// @ts-expect-error
const StringPDT = PersistentDataType.STRING;
const config = {
    rows: 5,
};
function estimateMaterial(soundKey) {
    let mat = materialKeys.find((e) => soundKey.includes(e));
    switch (mat) {
        case 'BUBBLE_COLUMN':
        case 'WATER': {
            mat = 'WATER_BUCKET';
            break;
        }
        case 'FIRE':
        case 'LAVA': {
            mat = 'LAVA_BUCKET';
            break;
        }
        case 'END_PORTAL':
        case 'END_GATEWAY': {
            mat = 'END_PORTAL_FRAME';
            break;
        }
        case 'TRIPWIRE': {
            mat = 'STRING';
            break;
        }
        case 'SWEET_BERRY_BUSH': {
            mat = 'SWEET_BERRIES';
            break;
        }
    }
    return mat ? Material.getMaterial(mat) : Material.STICK;
}
function setCustomData(item, object) {
    const keys = Object.keys(object).sort((a, b) => {
        if (a > b)
            return 1;
        if (a < b)
            return -1;
        return 0;
    });
    const meta = item.getItemMeta();
    const container = meta.getPersistentDataContainer();
    container.set(new NamespacedKey(stdlib_paper_1.plugin, 'keys'), StringPDT, JSON.stringify(keys.map((e) => [e, typeof object[e]])));
    keys.forEach((e) => container.set(new NamespacedKey(stdlib_paper_1.plugin, e), StringPDT, object[e].toString()));
    item.setItemMeta(meta);
}
function getCustomDataCurry() {
    return function getCustomData(item) {
        const container = item.getItemMeta().getPersistentDataContainer();
        const rawKeys = container.get(new NamespacedKey(stdlib_paper_1.plugin, 'keys'), StringPDT);
        if (!rawKeys)
            return;
        const keys = JSON.parse(rawKeys);
        const output = {};
        keys.forEach(([key, primitiveType]) => {
            output[key] = container.get(new NamespacedKey(stdlib_paper_1.plugin, key), StringPDT);
            switch (primitiveType) {
                case 'boolean': {
                    output[key] = Boolean(output[key]);
                    break;
                }
                case 'number': {
                    // Hopefully it ain't a float
                    output[key] = parseInt(output[key]);
                    break;
                }
            }
        });
        return output;
    };
}
const getCustomFlags = getCustomDataCurry();
class SoundViewer {
}
exports.SoundViewer = SoundViewer;
_a = SoundViewer;
SoundViewer.isActive = false;
SoundViewer.isPlaying = false;
SoundViewer.initialize = () => {
    _a.initializeCommands();
    _a.initializeEvents();
    _a.isActive = true;
};
SoundViewer.initializeCommands = () => {
    (0, stdlib_paper_1.command)({
        name: 'soundlibrary',
        execute: (sender, filterString = '') => {
            if (sender.getName() === 'CONSOLE')
                return;
            const player = stdlib_paper_1.server.getPlayer(sender.getName());
            player.openInventory(_a.createInventory(0, filterString));
        },
        tabComplete: (sender, filterString) => {
            return soundKeys.filter((e) => e.includes(filterString.toUpperCase()));
        },
    });
};
SoundViewer.initializeEvents = () => {
    (0, stdlib_paper_1.event)('org.bukkit.event.inventory.InventoryClickEvent', (event) => {
        const item = event.getCurrentItem();
        if (!item)
            return;
        const data = getCustomFlags(item);
        const player = event.getWhoClicked();
        if (!data)
            return;
        if (!data.menu)
            return;
        event.setCancelled(true);
        if (data.soundKey) {
            player.playSound(player.getLocation(), Sound[data.soundKey], 10, data.pitch ?? 1);
            return;
        }
        if (typeof data.offset === 'number') {
            player.openInventory(_a.createInventory(data.offset, data.filterString ?? ''));
        }
        if (typeof data.offset === 'number') {
            player.openInventory(_a.createInventory(data.offset, data.filterString ?? '', data.pitch));
        }
        if (!!data.action) {
            switch (data.action) {
                case 'StopSound': {
                    for (const sound of Sound.values()) {
                        player.stopSound(sound);
                    }
                    break;
                }
            }
        }
    });
};
SoundViewer.createInventory = (offset = 0, filterString, pitch = 1) => {
    const size = config.rows * MAX_INVENTORY_COL;
    const inventory = stdlib_paper_1.server.createInventory(undefined, size);
    const maxPageSize = size - MAX_INVENTORY_COL;
    const filteredSounds = soundKeys.filter((e) => e.includes(filterString.toUpperCase()));
    const maxPage = Math.round(filteredSounds.length / maxPageSize);
    for (let i = 0; i < size - MAX_INVENTORY_COL; i++) {
        let index = i + offset * maxPageSize;
        if (!filteredSounds[index])
            break;
        const soundKey = filteredSounds[index];
        try {
            inventory.setItem(i, createMenuItem({
                displayName: `${index}: ${soundKey}`,
                customData: {
                    soundKey,
                    pitch,
                },
                material: estimateMaterial(soundKey),
            }));
        }
        catch (err) {
            console.log(`${i} ${soundKey} failed.`);
        }
    }
    const actionRow = size - MAX_INVENTORY_COL;
    // Next Page
    if (offset + 1 <= maxPage) {
        inventory.setItem(actionRow + (MAX_INVENTORY_COL - 1), createMenuItem({
            displayName: 'Next Page',
            customData: {
                offset: offset + 1,
                filterString,
                pitch: pitch,
            },
            material: Material.ARROW,
        }));
    }
    // Prev Page
    if (offset > 0) {
        inventory.setItem(actionRow, createMenuItem({
            displayName: 'Previous Page',
            customData: {
                offset: offset - 1,
                filterString,
                pitch: pitch,
            },
            material: Material.OAK_BUTTON,
        }));
    }
    // Stop Sound
    inventory.setItem(actionRow + 1, createMenuItem({
        displayName: 'Stop Sound',
        customData: {
            action: 'StopSound',
        },
        material: Material.BARRIER,
    }));
    // Current Page
    inventory.setItem(actionRow + 7, createMenuItem({
        displayName: 'Current Page',
        customData: {},
        lore: [`${offset + 1}/${maxPage + 1}`],
        material: Material.RED_STAINED_GLASS,
    }));
    // -Pitch
    if (pitch > 0) {
        inventory.setItem(actionRow + 3, createMenuItem({
            displayName: '-Pitch',
            customData: {
                offset,
                filterString,
                pitch: pitch - 1,
            },
            lore: [`${pitch}`],
            material: Material.RED_WOOL,
        }));
    }
    // +Pitch
    if (pitch < 10)
        inventory.setItem(actionRow + 4, createMenuItem({
            displayName: '+Pitch',
            customData: {
                offset,
                filterString,
                pitch: pitch + 1,
            },
            lore: [`${pitch}`],
            material: Material.GREEN_WOOL,
        }));
    return inventory;
};
function createMenuItem({ displayName, customData, material, lore }) {
    const item = new ItemStack(material);
    setCustomData(item, {
        ...customData,
        menu: true,
    });
    const meta = item.getItemMeta();
    meta.setDisplayName(displayName);
    if (lore) {
        // @ts-expect-error
        meta.setLore(lore);
    }
    item.setItemMeta(meta);
    return item;
}
