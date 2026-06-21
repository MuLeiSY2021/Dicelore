// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import {
  BookMarked, SearchCheck, PackageOpen, Download, Globe, Users, Layers, SlidersHorizontal,
  Swords, FileCog, CircleCheckBig, CircleDot, Circle, Search, Plus, User, Pencil, ChevronUp,
  ChevronDown, Sparkles, ArrowUp, ShieldCheck, AlertTriangle,
} from "lucide-react";

// 团本制作（组件5 构建台 Web 门面 · 展示态静态还原 build.html）。
// 真实数据接线属组件5 合并(阻塞)，本页先做风格对齐的静态占位。
export default function BuildPage() {
  return (
    <div className="build">
      <div className="ctx">
        <BookMarked className="lucide" />
        <span className="name">黑风寨的钟声</span><span className="badge">草稿 v0.3 · 占位</span>
        <span className="sp" />
        <button className="act"><SearchCheck className="lucide" />校验整包</button>
        <button className="act"><PackageOpen className="lucide" />导入原著</button>
        <button className="act go"><Download className="lucide" />导出团本包</button>
      </div>

      <div className="body">
        <nav className="sidenav">
          <div className="sn-grp">内容</div>
          <div className="sn"><Globe className="lucide" />世界设定<span className="ct">12</span></div>
          <div className="sn on"><Users className="lucide" />NPC<span className="ct">5</span></div>
          <div className="sn"><Layers className="lucide" />卡池<span className="ct">3</span></div>
          <div className="sn"><SlidersHorizontal className="lucide" />规则·分档<span className="ct">4</span></div>
          <div className="sn"><Swords className="lucide" />阵线 Front<span className="ct">1</span></div>
          <div className="sn"><FileCog className="lucide" />Manifest</div>
          <div className="sn-grp">构建进度</div>
          <div className="sn"><CircleCheckBig className="lucide" />世界观<span className="stg done" /></div>
          <div className="sn"><CircleDot className="lucide" />人物<span className="stg now" /></div>
          <div className="sn"><Circle className="lucide" />卡池<span className="stg" /></div>
          <div className="sn"><Circle className="lucide" />机制<span className="stg" /></div>
        </nav>

        <div className="main">
          <div className="mtool">
            <span className="t">NPC · 人物</span><span className="sp" />
            <button className="btn"><Search className="lucide" />搜索</button>
            <button className="btn"><Plus className="lucide" />新建 NPC</button>
          </div>
          <div className="mbody">
            <div className="npc">
              <div className="nh"><span className="av"><User className="lucide" /></span><span className="nm">钟三爷</span><span className="tag">头领</span><span className="tag">有 sheet 卡</span><span className="ed"><Pencil className="lucide" /><ChevronUp className="lucide" /></span></div>
              <div className="nb">
                <div className="prose"><div className="lbl">人设散文</div>黑风寨的当家，使一对子母钟锤。耳背，逢整点必亲自巡钟楼；重义轻财，最恨被人坏了规矩。早年是镖师，因一桩冤案落草。</div>
                <div className="card"><div className="lbl">sheet 卡</div>
                  <div className="crow"><span>HP</span><b>40</b></div>
                  <div className="crow"><span>子母钟锤</span><b>+6</b></div>
                  <div className="crow"><span>耳背</span><b>trait</b></div>
                  <div className="crow" style={{ border: "none" }}><span>巡逻</span><b>整点</b></div>
                </div>
              </div>
            </div>
            <div className="npc collapsed">
              <div className="nh"><span className="av"><User className="lucide" /></span><span className="nm">王捕头</span><span className="tag">追兵</span><span className="ed"><Pencil className="lucide" /><ChevronDown className="lucide" /></span></div>
            </div>
            <div className="npc collapsed">
              <div className="nh"><span className="av"><User className="lucide" /></span><span className="nm">哑婆</span><span className="tag">线人</span><span className="tag" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>缺卡</span><span className="ed"><Pencil className="lucide" /><ChevronDown className="lucide" /></span></div>
            </div>
          </div>
        </div>

        <div className="aside">
          <div className="as-h"><Sparkles className="lucide" />构建助手</div>
          <div className="chat">
            <div className="msg u">把《黑风寨》第三章里的人物补全，关键的给 sheet 卡</div>
            <div className="msg a"><div className="who"><Sparkles className="lucide" />构建助手</div>检索到第三章 3 个人物。已为「钟三爷」补 4 条属性，新增「王捕头」「哑婆」。哑婆是线人、暂未给卡。<div className="did">↳ add_npc ×2 · set_sheet_cell ×4</div></div>
            <div className="msg a"><div className="who"><Sparkles className="lucide" />构建助手</div>建议给哑婆加「听力」trait——她虽哑但耳灵，是情报来源。要加吗？</div>
          </div>
          <div className="cin"><input defaultValue="给哑婆加听力 trait" /><span className="send"><ArrowUp className="lucide" /></span></div>
          <div className="valid">
            <div className="vh"><ShieldCheck className="lucide" style={{ color: "var(--ok)" }} />整包校验<span className="chip ok">0 error</span><span className="chip warn">2 warn</span></div>
            <div className="vitem"><AlertTriangle className="lucide" /><span><span className="f">npc/哑婆.md</span> 缺 sheet 卡，运行时无属性可裁决</span></div>
            <div className="vitem"><AlertTriangle className="lucide" /><span><span className="f">manifest.clock</span> 指向「世界.钟楼示警」，该 attr 尚未在 sheets 声明</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
