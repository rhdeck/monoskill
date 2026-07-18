import { gsap } from "gsap";

const skills = ["ab-testing","ad-creative","ads","ai-seo","analytics","aso","churn-prevention","co-marketing","cold-email","community-marketing","competitor-profiling","competitors","content-strategy","copy-editing","copywriting","cro","customer-research","directory-submissions","emails","free-tools","image","launch","lead-magnets","marketing-council","marketing-ideas","marketing-loops","marketing-plan","marketing-psychology","offers","onboarding","paywalls","popups","pricing","product-marketing","programmatic-seo","prospecting","public-relations","referrals","revops","sales-enablement","schema","seo-audit","signup","site-architecture","sms","social","video"];
const copy = {
  pressure: {
    before:["01 · Before","Forty-seven skills flood discovery.","Every useful capability advertises itself separately."],
    during:["02 · During","Package the collection without loss.","Every skill crosses one visible throat into the same small package."],
    after:["03 · After","The pressure is gone. The abilities remain.","One 331-character entry still routes to all 47 skills."]
  },
  press: {
    before:["01 · Before","The catalogue crowds the page.","Forty-seven names compete for the same context window."],
    during:["02 · During","Bind the names behind one index.","The entries align and move behind a single compact cover."],
    after:["03 · After","The page can breathe.","The 331-character index opens the full catalogue only when needed."]
  },
  gravity: {
    before:["01 · Before","Discovery has too many satellites.","The small package already exists at the center."],
    during:["02 · During","Collapse the orbit, not the abilities.","Forty-seven routes converge on one fixed, compact center."],
    after:["03 · After","Small center. Large reach.","The context is 99% lighter; all 47 abilities remain available."]
  }
};

for (const field of document.querySelectorAll("[data-skills]")) skills.forEach((skill,index)=>{const item=document.createElement("span");item.textContent=skill;item.dataset.index=index;field.append(item);});
for (const grid of document.querySelectorAll("[data-cells]")) skills.forEach(()=>grid.append(document.createElement("span")));
for (const field of document.querySelectorAll("[data-orbit-skills]")) skills.forEach((skill,index)=>{const item=document.createElement("span");const ring=index%3;const angle=(index/skills.length)*Math.PI*2+ring*.32;const rx=[43,32,21][ring];const ry=[32,24,16][ring];item.textContent=skill;item.style.setProperty("--x",`${50+Math.cos(angle)*rx}%`);item.style.setProperty("--y",`${44+Math.sin(angle)*ry}%`);item.style.setProperty("--rotation",`${angle*180/Math.PI+90}deg`);item.dataset.index=index;field.append(item);});

function setCopy(section, key) {
  const [beat,title,detail]=copy[section.dataset.animatic][key];
  section.querySelector("[data-beat]").textContent=beat;
  section.querySelector("[data-title]").textContent=title;
  section.querySelector("[data-detail]").textContent=detail;
  [...section.querySelectorAll(".beat-progress i")].forEach((bar,index)=>bar.classList.toggle("active",index <= ["before","during","after"].indexOf(key)));
  section.dataset.pose=key;
  const tankLabel=section.querySelector(".tank-label");
  if(tankLabel) tankLabel.textContent=key==="before"?"47 separate entries":key==="during"?"Packaging 47 / 47":"Discovery context cleared";
}

function deltaTo(target,element){const a=target.getBoundingClientRect();const b=element.getBoundingClientRect();return{x:a.left+a.width/2-(b.left+b.width/2),y:a.top+a.height/2-(b.top+b.height/2)};}
function countDown(element,progress){const value=Math.round(32817+(331-32817)*progress);element.textContent=value.toLocaleString("en-US");}

function baseTimeline(section) {
  const wash=section.querySelector(".scene-wash");
  const timeline=gsap.timeline({paused:true,repeat:-1,repeatDelay:.5,defaults:{ease:"power2.inOut"}});
  timeline.eventCallback("onRepeat",()=>setCopy(section,"before"));
  return {timeline,wash};
}

function pressureTimeline(section) {
  const {timeline,wash}=baseTimeline(section);const items=[...section.querySelectorAll(".skill-field span")];const cells=[...section.querySelectorAll(".package-cells span")];const water=section.querySelector(".water");const packageTarget=section.querySelector(".mono-package");const result=section.querySelector(".result-mark");const metric=section.querySelector("[data-count]");const path=[...section.querySelectorAll(".flow-path i")];const geometry=items.map(item=>deltaTo(packageTarget,item));
  gsap.set(items,{x:0,y:0,scale:1,rotation:0,autoAlpha:1});gsap.set(cells,{autoAlpha:0,scale:.45});gsap.set(water,{scaleY:1});gsap.set(result,{autoAlpha:0,y:18});gsap.set(path,{scaleX:0,autoAlpha:0});setCopy(section,"before");
  timeline.addLabel("before",0).to({}, {duration:2})
    .addLabel("during").call(()=>setCopy(section,"during"))
    .to(path,{scaleX:1,autoAlpha:1,duration:.5,stagger:.08},"during")
    .to(water,{scaleY:.13,duration:3},"during+=.15")
    .to(items,{x:(i)=>geometry[i].x,y:(i)=>geometry[i].y,scale:.1,rotation:(i)=>(i%3-1)*5,autoAlpha:0,duration:1.25,stagger:{amount:2.25,from:"end"},ease:"power2.in"},"during+=.25")
    .to(cells,{autoAlpha:1,scale:1,duration:.25,stagger:{amount:2.25,from:"start"},ease:"power2.out"},"during+=.5")
    .to({p:0},{p:1,duration:2.6,onUpdate:function(){countDown(metric,this.targets()[0].p);}},"during+=.2")
    .to(path,{autoAlpha:0,duration:.4},"during+=2.8")
    .addLabel("after").call(()=>setCopy(section,"after"))
    .to(result,{autoAlpha:1,y:0,duration:.5,ease:"power2.out"},"after")
    .to({}, {duration:2.4})
    .to(wash,{autoAlpha:1,duration:.35})
    .set(items,{x:0,y:0,scale:1,rotation:0,autoAlpha:1}).set(cells,{autoAlpha:0,scale:.45}).set(water,{scaleY:1}).set(result,{autoAlpha:0,y:18}).set(path,{scaleX:0,autoAlpha:0}).call(()=>{metric.textContent="32,817";setCopy(section,"before");}).to(wash,{autoAlpha:0,duration:.35});
  return timeline;
}

function pressTimeline(section) {
  const {timeline,wash}=baseTimeline(section);const items=[...section.querySelectorAll(".press-field span")];const cells=[...section.querySelectorAll(".package-cells span")];const book=section.querySelector(".mono-book");const rails=[...section.querySelectorAll(".bind-rails i")];const result=section.querySelector(".editorial-result");const geometry=items.map(item=>deltaTo(book,item));
  gsap.set(items,{x:0,y:0,scale:1,rotation:0,autoAlpha:1});gsap.set(cells,{autoAlpha:0,scale:.45});gsap.set(rails,{scaleX:0,autoAlpha:0});gsap.set(result,{autoAlpha:0,y:16});setCopy(section,"before");
  timeline.addLabel("before",0).to({}, {duration:2})
    .addLabel("during").call(()=>setCopy(section,"during"))
    .to(items,{rotation:(i)=>(i%5-2)*.35,x:(i)=>Math.max(0,geometry[i].x*.22),y:(i)=>geometry[i].y*.12,duration:.75,stagger:{amount:.6,from:"end"}},"during")
    .to(rails,{scaleX:1,autoAlpha:1,duration:.5,stagger:.1},"during+=.3")
    .to(items,{x:(i)=>geometry[i].x,y:(i)=>geometry[i].y,scale:.09,rotation:0,autoAlpha:0,duration:1.4,stagger:{amount:2.1,from:"end"},ease:"power2.in"},"during+=.75")
    .to(cells,{autoAlpha:1,scale:1,duration:.25,stagger:{amount:2.1,from:"start"}},"during+=1")
    .to(rails,{autoAlpha:0,duration:.4},"during+=2.8")
    .addLabel("after").call(()=>setCopy(section,"after"))
    .to(result,{autoAlpha:1,y:0,duration:.5,ease:"power2.out"},"after")
    .to({}, {duration:2.4}).to(wash,{autoAlpha:1,duration:.35})
    .set(items,{x:0,y:0,scale:1,rotation:0,autoAlpha:1}).set(cells,{autoAlpha:0,scale:.45}).set(rails,{scaleX:0,autoAlpha:0}).set(result,{autoAlpha:0,y:16}).call(()=>setCopy(section,"before")).to(wash,{autoAlpha:0,duration:.35});
  return timeline;
}

function gravityTimeline(section) {
  const {timeline,wash}=baseTimeline(section);const items=[...section.querySelectorAll(".orbit-skills span")];const cells=[...section.querySelectorAll(".package-cells span")];const seed=section.querySelector(".mono-seed");const orbits=[...section.querySelectorAll(".orbit")];const result=section.querySelector(".gravity-result");const geometry=items.map(item=>deltaTo(seed,item));
  gsap.set(items,{x:0,y:0,scale:1,autoAlpha:1});gsap.set(cells,{autoAlpha:0,scale:.45});gsap.set(orbits,{scale:1,autoAlpha:1});gsap.set(result,{autoAlpha:0,y:16});setCopy(section,"before");
  timeline.addLabel("before",0).to(items,{rotation:"+=2",duration:2,ease:"none"})
    .addLabel("during").call(()=>setCopy(section,"during"))
    .to(orbits,{scale:.32,autoAlpha:.2,duration:2.6},"during")
    .to(items,{x:(i)=>geometry[i].x,y:(i)=>geometry[i].y,scale:.08,autoAlpha:0,duration:1.4,stagger:{amount:2.15,from:"edges"},ease:"power2.in"},"during+=.2")
    .to(cells,{autoAlpha:1,scale:1,duration:.25,stagger:{amount:2.15,from:"start"}},"during+=.45")
    .addLabel("after").call(()=>setCopy(section,"after"))
    .to(result,{autoAlpha:1,y:0,duration:.5,ease:"power2.out"},"after")
    .to({}, {duration:2.4}).to(wash,{autoAlpha:1,duration:.35})
    .set(items,{x:0,y:0,scale:1,rotation:0,autoAlpha:1}).set(cells,{autoAlpha:0,scale:.45}).set(orbits,{scale:1,autoAlpha:1}).set(result,{autoAlpha:0,y:16}).call(()=>setCopy(section,"before")).to(wash,{autoAlpha:0,duration:.35});
  return timeline;
}

const builders={pressure:pressureTimeline,press:pressTimeline,gravity:gravityTimeline};
const animations={};const controls={};const reduceMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
for(const section of document.querySelectorAll("[data-animatic]")){
  const name=section.dataset.animatic;const timeline=builders[name](section);animations[name]=timeline;
  const toggle=section.querySelector('[data-action="toggle"]');
  const seekPose=(pose)=>{const offset=pose==="before"?.2:pose==="during"?2:.55;timeline.pause().seek(timeline.labels[pose]+offset);setCopy(section,pose);if(name==="pressure")section.querySelector("[data-count]").textContent=pose==="before"?"32,817":pose==="during"?"16,574":"331";toggle.textContent="Play";};
  controls[name]={seek:seekPose};
  section.querySelector('[data-action="replay"]').addEventListener("click",()=>{timeline.restart();toggle.textContent="Pause";});
  toggle.addEventListener("click",()=>{if(timeline.paused()){timeline.play();toggle.textContent="Pause";}else{timeline.pause();toggle.textContent="Play";}});
  section.querySelectorAll("[data-seek]").forEach(button=>button.addEventListener("click",()=>seekPose(button.dataset.seek)));
  if(reduceMotion){seekPose("after");}
  else {const observer=new IntersectionObserver(([entry])=>entry.isIntersecting?timeline.play():timeline.pause(),{threshold:.25});observer.observe(section);}
}
window.__animatics=animations;
window.__animaticControls=controls;
