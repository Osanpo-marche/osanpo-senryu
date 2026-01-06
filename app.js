document.getElementById("postBtn").addEventListener("click", () => {
  const name = document.getElementById("nickname").value;
  const senryu = document.getElementById("senryu").value;

  if (!senryu.trim()) {
    alert("川柳を入力してね");
    return;
  }

  alert("投稿（ダミー）\n" + (name || "散歩人") + "：\n" + senryu);
});
