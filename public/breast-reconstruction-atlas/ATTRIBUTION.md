# 模型來源與授權

本資料夾的 `chest.glb` 與 `meta.json` 由 Z-Anatomy 的 Blender 檔匯出並減面,依 **CC BY-SA 4.0** 授權釋出。

- Z-Anatomy, The libre 3D atlas of anatomy, CC BY-SA 4.0: https://github.com/Z-Anatomy/Models-of-human-anatomy
- BodyParts3D, © The Database Center for Life Science: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
  (Mitsuhashi et al., BodyParts3D: 3D structure database for anatomical concepts, Nucleic Acids Res 2009, doi:10.1093/nar/gkn613)

修改內容:座標轉為公尺、Y 軸朝上;鏡像物件的法線已翻正;網格減面;體表由 Z-Anatomy 體表分區合併。
體表皮膚(`skin` 網格,含上臂與手)改用 MakeHuman 的成年女性身體(MPFB2 基底網格與 macro targets,**CC0 1.0**:https://github.com/makehumancommunity/mpfb2),經手臂姿勢調整、縮放與逐層對齊到 Z-Anatomy 座標,並向外推以包住內部肌肉骨骼。產生腳本在 `tools/breast-atlas/female_skin/`。
內部骨骼、肌肉與血管仍來自成年男性模型。
乳房外形的突度與側面輪廓,依 liRBSM 平均乳房形狀(`artifacts/lirbsm-mean_pts.pt`,Weiherer et al.,MIT:https://github.com/mweiherer/local-irbsm)沿乳頭的矢狀剖面校正;本頁未包含該模型的資料或權重。乳房、乳腺、皮下脂肪、腫瘤、皮瓣、擴張器與假體由 `app.js` 依解剖位置程式建模,屬教學示意。

匯出腳本:`tools/breast-atlas/export_z_anatomy.py`。

本頁為衛教用示意,不是個人治療建議。臨床內容在 `content.js`,上線前需醫師審核。
