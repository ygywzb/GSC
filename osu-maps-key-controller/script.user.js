// ==UserScript==
// @name         Osu maps key controller
// @namespace    http://tampermonkey.net/
// @version      v0.0.1
// @description  旨在只需要键盘就能实现对谱面的各种操作
// @author       Anaaya
// @match        https://osu.ppy.sh/beatmapsets**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ppy.sh
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    // alert("可以做一个只用键盘就可以切换试听歌曲并下载的功能")
    // alert("当前乐曲：on the fm 2017年2月11日")
    // Your code here...
    /**
     * 简单的断言，断言失败会抛出异常
     * @param {boolean} condition
     * @param {string} message
     * @param {boolean} alertFlag 若为true，会弹出提示框
     */
    function assert(condition, message = "Assertion failed", alertFlag = false) {
        if (!condition) {
            if (alertFlag) {
                alert(message);
            }
            throw new Error(message);
        }
    }

    /**
     * 添加选中框
     * @param {HTMLDivElement} element
     */
    function addSelectionBox(element) {
        element.style.border = '5px solid lightgreen';
        element.style.borderRadius = '10px';
    }

    /**
     * 移除选中框
     * @param {HTMLDivElement} element
     */
    function removeSelectionBox(element) {
        element.style.border = '';
        element.style.borderRadius = '';
    }


    /**
     * 将一个元素（尽量）滚动到视野中间
     * @param {HTMLDivElement} element
     */
    function scrollIntoCenterView(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    let currentBeatmapSetItems = undefined;
    let currentIdx = undefined;

    /**
     * 获取缓存的谱面集列表
     * @returns {HTMLDivElement[]} 缓存的谱面集列表
     */
    function getBeatmapSetsItemsCache() {
        return currentBeatmapSetItems;
    }

    /**
     * 设置缓存的谱面集列表
     * @param {HTMLDivElement[]} current 需设置的谱面集列表
     * @returns {HTMLDivElement[]} 设置好的缓存的谱面集列表
     */
    function setBeatmapSetsItemsCache(current) {
        currentBeatmapSetItems = current;
        return currentBeatmapSetItems;
    }

    /**
     * 获取当前的角标
     * @return {number} 当前的角标
     */
    function getCurrentIdx() {
        return currentIdx;
    }

    /**
     * 设置当前角标
     * @param {number} nowIdx 设置的角标
     * @return {number} 设置后的角标
     */
    function setCurrentIdx(nowIdx) {
        currentIdx = nowIdx;
        return currentIdx;
    }

    /**
     * 清除所有标记的状态，包括缓存的谱面集列表、当前角标以及选择框
     */
    function clearAllCurrentStates() {
        debugger;;
        const current = getBeatmapSetsItemsCache();
        const currentIdx = getCurrentIdx();
        if (current && currentIdx && current[currentIdx]) {
            removeSelectionBox(current[currentIdx]);
        }
        setBeatmapSetsItemsCache(undefined);
        setCurrentIdx(undefined);
    }

    /**
     * 获取谱面集元素的具体信息
     * @param {HTMLDivElement} element
     * @returns {*} 一个信息对象
     */
    function getBeatMapSetInfo(element) {
        const [beatmapNameEle, byAuthorEle] = element.querySelectorAll(".beatmapset-panel__main-link.u-ellipsis-overflow");
        return {
            beatmapName: beatmapNameEle.innerHTML,
            byAuthor: byAuthorEle.innerHTML,
        }
    }

    /**
     * 按下谱面集的播放按钮
     * @param {HTMLDivElement} element 谱面集的元素
     */
    function clickPlayButton(element) {
        assert(element, "无法获取谱面集元素");
        const btn = element.querySelector(".play-button");
        assert(btn, "无法获取谱面集播放按钮");
        btn.click();
    }


    /**
     * 获取当前所有的谱面块。
     * @returns {HTMLDivElement[]} 当前所有的谱面集列表
     */
    function fetchCurrentBeatmapSetsItems() {
        /**
         * 注：
         * 每一个块都是一个谱面集（BeatmapSetItem）；
         * 其中一行包含多个谱面集（BeatmapSetsRow）；
         * 最后所有行组成最大的部分（BeatmapSetsItem）
         */
        const beatmapSetItems = document.querySelector(".beatmapsets__items");
        assert(beatmapSetItems, "无法获取所有谱面块, 因为beatmapSetItems为null");

        const beatmapSetRows = beatmapSetItems.childNodes
        const currentBeatmapSetItems = [];
        beatmapSetRows.forEach(row => {
            const items = row.childNodes;
            currentBeatmapSetItems.push(...items);
        });

        console.info(`当前一共加载了${currentBeatmapSetItems.length}个谱面集`)
        return currentBeatmapSetItems;
    }

    /**
     * 新获取列表时，获取旧的元素在新列表中的位置
     * @param {HTMLDivElement[]} oldList
     * @param {HTMLDivElement[]} newList
     * @param {number} oldIdx
     * @returns {number}
     */
    function findNewCurrentIdx(oldList, newList, oldIdx) {
        if (oldList[0] === newList[0]) {
            return oldIdx;
        }
        return newList.indexOf(oldList[oldIdx]);
    }

    /**
     * 根据当前列表的当前元素位置，计算出下一次移动的idx。
     * @param {number} nowIdx
     * @param {number} row
     * @param {string} movingTo 移动方向，上(up)下(down)左(left)右(right)
     * @returns {number} 移动后对应的idx，有可能会越界。
     */
    function getNextIdx(nowIdx, row, movingTo) {
        movingTo = movingTo.toLowerCase();
        if (movingTo === "up") {
            return nowIdx - row;
        }
        if (movingTo === "down") {
            return nowIdx + row;
        }
        if (movingTo === "left") {
            return nowIdx - 1;
        }
        if (movingTo === "right") {
            return nowIdx + 1;
        }
        throw new Error("移动方向非法");
    }

    /**
     * 找到下一个谱面集，第一次会返回当前的第一个块。
     * 下一个谱面集会被标记。
     * @param {string} movingTo 移动方向，上(up)下(down)左(left)右(right)
     * @returns {HTMLDivElement} 下一个谱面集
     */
    function goToNextBeatMapSetItem(movingTo) {
        debugger;;
        const fixedRow = 2; // 先写上

        let current = getBeatmapSetsItemsCache()
        const fetched = fetchCurrentBeatmapSetsItems();

        //
        if (!current) {
            current = setBeatmapSetsItemsCache(fetched);
        }

        let currentIdx = getCurrentIdx();
        // 第一次
        if (currentIdx === undefined) {
            currentIdx = setCurrentIdx(0);

            const selected = current[currentIdx];
            scrollIntoCenterView(selected);
            addSelectionBox(selected);

            return selected;
        }

        // 确保即使列表更新，但当前谱面集仍然存在
        // 若不存在，找当前列表中间的一个代替
        currentIdx = findNewCurrentIdx(current, fetched, currentIdx);
        current = fetched;
        if (currentIdx === -1) {
            currentIdx = Math.floor(fetched.length / 2) - 1;
        }

        // 计算下一个
        let nextIdx = getNextIdx(currentIdx, fixedRow, movingTo);

        // 角标越界（太大/太小），尝试更新列表
        // 感觉几率很小
        if (nextIdx >= current.length || nextIdx < 0) {
            const fetched = fetchCurrentBeatmapSetsItems();
            currentIdx = findNewCurrentIdx(current, fetched, currentIdx);
            // 重新尝试获取下一个idx，此时应该不会越界
            nextIdx = getNextIdx(currentIdx, fixedRow, movingTo);
            assert(nextIdx < fetched.length && nextIdx >= 0, "似乎已经走到头了", true);
            current = setBeatmapSetsItemsCache(fetched);
        }
        current = setBeatmapSetsItemsCache(current);

        // 找到下一个谱面集
        removeSelectionBox(current[currentIdx]);
        currentIdx = setCurrentIdx(nextIdx);

        const selected = current[currentIdx];
        scrollIntoCenterView(selected);
        addSelectionBox(selected);

        return selected;
    }

    /**
     * 绑定键位
     */
    function bindKeys() {
        let cooling = false;
        const bindedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"]
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && bindedKeys.includes(e.key)) {
                if (cooling) return;
                cooling = true;

                if (e.key === 'ArrowUp') { goToNextBeatMapSetItem("up") }
                if (e.key === 'ArrowDown') { goToNextBeatMapSetItem("down") }
                if (e.key === 'ArrowLeft') { goToNextBeatMapSetItem("left") }
                if (e.key === 'ArrowRight') { goToNextBeatMapSetItem("right") }
                if (e.key === 'Enter') { clickPlayButton(getBeatmapSetsItemsCache()[getCurrentIdx()]) }

                setTimeout(() => cooling = false, 500);
            }
        });
    }

    /**
     * 绑定一个观察器，用于监听网址变化，在网址改变时执行一个函数，
     * 单页应用改变网址不会重新加载脚本资源。
     * @param {Function} fallback
     */
    function bindUrlChangeObserver(fallback) {
        let oldUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== oldUrl) {
                oldUrl = location.href;
                fallback();// 执行你的函数
            }
        }).observe(document, { subtree: true, childList: true });
    }

    function sleepForSeconds(seconds) {
        return new Promise((resolve, _) => {
            setTimeout(() => { resolve() }, seconds * 1000);
        })
    }

    const anaaya = {
        next: async (num = 1) => {
            for (let i = 0; i < num; i++) {
                goToNextBeatMapSetItem("right");
                await sleepForSeconds(0.5);
            }
            console.debug("go to end.")
        },
    }

    function scriptStart() {
        console.info("script start.");
        window.anaaya = anaaya;
        bindKeys();
        bindUrlChangeObserver(clearAllCurrentStates);
        console.info("script load success.");
    }

    setTimeout(scriptStart, 5000);
})();