// 画像をクリックで拡大し、クリックまたは Esc で閉じる
(function () {
  var lb = document.getElementById("lb");
  if (!lb) return;
  var im = lb.querySelector("img");
  document.querySelectorAll("figure.shot img").forEach(function (i) {
    i.addEventListener("click", function () {
      im.src = i.src;
      lb.classList.add("on");
    });
  });
  lb.addEventListener("click", function () {
    lb.classList.remove("on");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") lb.classList.remove("on");
  });
})();
