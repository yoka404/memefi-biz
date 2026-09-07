const pairs=[["MEMEFI","HOOD","0.00412","+18.4","118.40","1.2M"],["BONER","HIMS","0.02110","-11.2","31.40","12.5M"],["AI","NVDA","0.18800","+6.1","178.20","6.2M"],["MEME","AMC","0.00940","+42.0","3.12","4.1M"],["SAYLORMOON","MSTR","0.00081","-4.7","332.00","890K"],["LONGDOG","TSLA","0.01440","+2.2","248.60","2.0M"]];
const wire=[
  ["00:41","HOOD +2.1% after hours. The paper MEMEFI ratio slipped on thin mock liquidity."],
  ["00:28","BONER/HIMS continues to hold a material share of tokenized HIMS float."],
  ["00:19","MEME/AMC remains active. Volume is elevated relative to peer pairs."],
  ["00:11","AI/NVDA remains the most liquid semiconductor pairing on the board."],
  ["23:58","Desk note: this wire is fabricated for layout. Figures are not live."]
];
document.getElementById("rows").innerHTML=pairs.map(p=>{const up=p[3].startsWith("+");return `<tr><td>$${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td class="${up?"up":"dn"}">${p[3]}%</td><td>${p[4]}</td><td>${p[5]}</td></tr>`}).join("");
document.getElementById("wire").innerHTML=wire.map(w=>`<li><time>${w[0]}</time>${w[1]}</li>`).join("");
setInterval(()=>{document.getElementById("px").textContent=(0.00412+(Math.random()-.5)*0.00005).toFixed(5)},2500);
