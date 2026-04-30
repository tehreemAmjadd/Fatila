"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Plus, Trash2, Check, Clock, AlertTriangle,
  ListTodo, CircleCheck, Flag, Calendar, Lock,CheckSquare,X
} from "lucide-react";

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  free:     { label:"Free",         color:"#8899bb" },
  trial:    { label:"Trial",        color:"#ffd700" },
  starter:  { label:"Starter",      color:"#00ff99" },
  pro:      { label:"Professional", color:"#3b9eff" },
  business: { label:"Business",     color:"#a78bfa" },
  expired:  { label:"Expired",      color:"#ff6b6b" },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  completed: boolean;
  createdAt: string;
}

const PRIORITY_COLOR = { low:"#00ff99", medium:"#ffd700", high:"#ff4d4d" };
const PRIORITY_BG    = { low:"rgba(0,255,153,.1)", medium:"rgba(255,215,0,.1)", high:"rgba(255,77,77,.1)" };

export default function TasksPage() {
  const { user } = useUser();
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter,     setFilter]     = useState<"all"|"pending"|"done">("all");
  const [dbUser,     setDbUser]     = useState<any>(null);

  // Form state
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [priority,    setPriority]    = useState<"low"|"medium"|"high">("medium");

  const email = user?.primaryEmailAddress?.emailAddress;

  // ── Fetch plan ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;
    fetch("/api/get-user", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) })
      .then(r=>r.json()).then(setDbUser).catch(console.error);
  }, [email]);

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/tasks?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch(err){console.error(err);}
    finally{setLoading(false);}
  },[email]);

  useEffect(()=>{fetchTasks();},[fetchTasks]);

  // ── Create task ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) return alert("Title is required");
    setSubmitting(true);
    try {
      const res  = await fetch("/api/tasks", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email, title, description, dueDate:dueDate||null, priority }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks(prev=>[data.task,...prev]);
        setTitle(""); setDescription(""); setDueDate(""); setPriority("medium");
        setShowModal(false);
      }
    } catch(err){console.error(err);}
    finally{setSubmitting(false);}
  };

  // ── Toggle complete ───────────────────────────────────────────────────────
  const toggleComplete = async (task: Task) => {
    const updated = !task.completed;
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,completed:updated}:t));
    try {
      await fetch("/api/tasks", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ taskId:task.id, email, completed:updated }),
      });
    } catch {
      setTasks(prev=>prev.map(t=>t.id===task.id?{...t,completed:!updated}:t));
    }
  };

  // ── Delete task ───────────────────────────────────────────────────────────
  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    setTasks(prev=>prev.filter(t=>t.id!==taskId));
    try {
      await fetch("/api/tasks", {
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ taskId, email }),
      });
    } catch(err){console.error(err);}
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAdmin       = dbUser?.role === "admin";
  const isTest        = dbUser?.role === "test";
  const effectivePlan = ((dbUser?.effectivePlan as PlanKey)||"free");
  const planCfg       = PLAN_CONFIG[effectivePlan]||PLAN_CONFIG.free;
  const canAccess     = isAdmin || isTest || (effectivePlan!=="free" && effectivePlan!=="expired");

  const filteredTasks = tasks.filter(t=>{
    if (filter==="pending") return !t.completed;
    if (filter==="done")    return t.completed;
    return true;
  });

  const pendingCount  = tasks.filter(t=>!t.completed).length;
  const doneCount     = tasks.filter(t=>t.completed).length;
  const highCount     = tasks.filter(t=>t.priority==="high"&&!t.completed).length;

  const formatDate = (d: string|null) => {
    if (!d) return null;
    const diff = new Date(d).getTime() - new Date().getTime();
    const days = Math.ceil(diff / 86400000);
    if (days < 0)  return { label:`Overdue by ${Math.abs(days)}d`, color:"#ff4d4d" };
    if (days === 0) return { label:"Due today",    color:"#ffd700" };
    if (days === 1) return { label:"Due tomorrow", color:"#ffd700" };
    return { label:`Due in ${days}d`, color:"#8899bb" };
  };

  return (
    <>
      <div className="main">

        {/* ── FREE / EXPIRED GATE ── */}
        {!canAccess && (
          <div className="gate-box">
            <div className="gate-icon"><Lock size={30} strokeWidth={1.4} color="#8899bb"/></div>
            <h3>{effectivePlan==="expired"?"Your trial has expired":"Tasks is a Paid Feature"}</h3>
            <p>
              {effectivePlan==="expired"
                ?"Upgrade to continue managing your follow-up tasks and stay on top of your sales pipeline."
                :"Upgrade to create and manage tasks, set due dates, and track your sales follow-ups."}
            </p>
            <a href="/billing" className="gate-cta">
              {effectivePlan==="expired"?"Choose a Plan":"Start Free Trial or Upgrade"}
            </a>
            <div className="gate-perks">
              {["Create & manage tasks","Priority levels","Due date tracking","Completion tracking"].map(f=>(
                <span key={f} className="perk"><CheckSquare size={11} color="#00ff99"/>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {canAccess && (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Tasks</h1>
                <p>Manage your follow-ups and sales activities</p>
              </div>
              <button className="create-btn" onClick={()=>setShowModal(true)}>
                <Plus size={16} strokeWidth={2.5}/>New Task
              </button>
            </div>

            {/* Stats */}
            <div className="task-stats">
              {[
                { Icon:ListTodo,   label:"Total",    value:tasks.length,  color:"#00ff99", border:"rgba(0,255,153,.2)"  },
                { Icon:Clock,      label:"Pending",  value:pendingCount,  color:"#ffd700", border:"rgba(255,215,0,.2)"  },
                { Icon:CircleCheck,label:"Done",     value:doneCount,     color:"#00e676", border:"rgba(0,230,118,.2)"  },
                { Icon:Flag,       label:"High Priority", value:highCount, color:"#ff4d4d", border:"rgba(255,77,77,.2)" },
              ].map(({Icon,label,value,color,border})=>(
                <div key={label} className="stat-card" style={{borderColor:border}}>
                  <div className="stat-icon-wrap" style={{background:`${color}14`,border:`1px solid ${color}28`}}>
                    <Icon size={18} color={color} strokeWidth={1.8}/>
                  </div>
                  <div>
                    <span className="stat-num" style={{color}}>{value}</span>
                    <span className="stat-lbl">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="filter-tabs">
              {([
                {id:"all",     label:`All (${tasks.length})`},
                {id:"pending", label:`Pending (${pendingCount})`},
                {id:"done",    label:`Done (${doneCount})`},
              ] as const).map(({id,label})=>(
                <button key={id} className={`tab ${filter===id?"active":""}`} onClick={()=>setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Task list */}
            {loading ? (
              <div className="loading-list">
                {[...Array(4)].map((_,i)=><div key={i} className="skeleton"/>)}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon-wrap">
                  <CheckSquare size={40} color="#8899bb" strokeWidth={1.2}/>
                </div>
                <h3>{filter==="done"?"No completed tasks yet":"No tasks yet"}</h3>
                <p>{filter==="all"?"Create your first task to get started.":filter==="pending"?"All caught up!":"Complete some tasks to see them here."}</p>
                {filter==="all" && (
                  <button className="empty-create-btn" onClick={()=>setShowModal(true)}>
                    <Plus size={14}/>Create Task
                  </button>
                )}
              </div>
            ) : (
              <div className="task-list">
                {filteredTasks.map(task=>{
                  const due = formatDate(task.dueDate);
                  return (
                    <div key={task.id} className={`task-card priority-${task.priority} ${task.completed?"completed":""}`}>

                      {/* Checkbox */}
                      <button className={`check-btn ${task.completed?"checked":""}`} onClick={()=>toggleComplete(task)}>
                        {task.completed && <Check size={13} strokeWidth={3}/>}
                      </button>

                      {/* Content */}
                      <div className="task-body">
                        <div className="task-top">
                          <span className="task-title">{task.title}</span>
                          <div className="task-badges">
                            {/* Priority badge */}
                            <span className="priority-badge" style={{
                              color:PRIORITY_COLOR[task.priority],
                              background:PRIORITY_BG[task.priority],
                              border:`1px solid ${PRIORITY_COLOR[task.priority]}33`,
                            }}>
                              <Flag size={10} strokeWidth={2}/>
                              {task.priority.charAt(0).toUpperCase()+task.priority.slice(1)}
                            </span>

                            {/* Due date badge */}
                            {due && (
                              <span className="due-badge" style={{color:due.color}}>
                                <Calendar size={11} strokeWidth={1.8}/>
                                {due.label}
                              </span>
                            )}
                          </div>
                        </div>
                        {task.description && <p className="task-desc">{task.description}</p>}
                      </div>

                      {/* Delete */}
                      <button className="delete-btn" onClick={()=>handleDelete(task.id)} title="Delete">
                        <Trash2 size={15} strokeWidth={1.8}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CREATE TASK MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Plus size={18} color="#00ff99" strokeWidth={2.5}/>
                <h3>New Task</h3>
              </div>
              <button className="close-btn" onClick={()=>setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input value={title} onChange={e=>setTitle(e.target.value)}
                  placeholder="What needs to be done?" autoFocus
                  onKeyDown={e=>e.key==="Enter"&&handleCreate()}/>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)}
                  placeholder="Add details..." rows={3}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><Calendar size={11}/>Due Date</label>
                  <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
                </div>
                <div className="form-group">
                  <label><Flag size={11}/>Priority</label>
                  <select value={priority} onChange={e=>setPriority(e.target.value as any)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="submit-btn" onClick={handleCreate} disabled={submitting}>
                {submitting
                  ?<><span className="spinner"/>Creating...</>
                  :<><Plus size={14} strokeWidth={2.5}/>Create Task</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
        body{color:white;overflow-x:hidden;}

        /* Main */
        .main{margin-left:240px;padding:24px 28px;min-height:100vh;}

        /* Gate */
        .gate-box{text-align:center;padding:60px 20px;max-width:460px;margin:40px auto;}
        .gate-icon{width:64px;height:64px;border-radius:50%;background:rgba(136,153,187,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
        .gate-box h3{font-size:20px;margin-bottom:10px;}
        .gate-box p{color:#8899bb;font-size:14px;margin-bottom:22px;line-height:1.6;}
        .gate-cta{display:inline-block;background:#00ff99;color:#020817;font-weight:700;padding:12px 26px;border-radius:30px;text-decoration:none;font-size:14px;transition:.2s;}
        .gate-cta:hover{background:#00cc66;}
        .gate-perks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;}
        .perk{display:flex;align-items:center;gap:5px;background:rgba(0,255,153,.06);border:1px solid rgba(0,255,153,.14);color:#ccc;font-size:12px;padding:5px 12px;border-radius:20px;}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}
        .page-header h1{font-size:24px;font-weight:600;}
        .page-header p{color:#8899bb;font-size:13px;margin-top:4px;}
        .create-btn{display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;transition:.2s;white-space:nowrap;}
        .create-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,255,153,.3);}

        /* Stats */
        .task-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
        .stat-card{background:rgba(255,255,255,.04);border:1px solid;border-radius:12px;padding:16px;display:flex;align-items:center;gap:13px;}
        .stat-icon-wrap{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .stat-num{display:block;font-size:24px;font-weight:700;line-height:1.1;}
        .stat-lbl{display:block;font-size:12px;color:#8899bb;margin-top:2px;}

        /* Filter tabs */
        .filter-tabs{display:flex;gap:7px;margin-bottom:18px;}
        .tab{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#8899bb;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;transition:.2s;}
        .tab:hover{background:rgba(0,255,153,.05);color:#ccc;}
        .tab.active{background:rgba(0,255,153,.1);border-color:rgba(0,255,153,.3);color:#00ff99;}

        /* Loading */
        .loading-list{display:flex;flex-direction:column;gap:10px;}
        .skeleton{height:72px;background:rgba(255,255,255,.04);border-radius:12px;animation:pulse 1.4s ease infinite;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}

        /* Empty */
        .empty-state{text-align:center;padding:70px 20px;}
        .empty-icon-wrap{width:72px;height:72px;border-radius:50%;background:rgba(136,153,187,.08);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
        .empty-state h3{font-size:18px;margin-bottom:8px;}
        .empty-state p{color:#8899bb;font-size:14px;margin-bottom:20px;}
        .empty-create-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(0,255,153,.1);border:1px solid rgba(0,255,153,.2);color:#00ff99;padding:9px 18px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;transition:.2s;}
        .empty-create-btn:hover{background:rgba(0,255,153,.18);}

        /* Task list */
        .task-list{display:flex;flex-direction:column;gap:10px;}
        .task-card{display:flex;align-items:flex-start;gap:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:15px 17px;transition:.3s;border-left:3px solid transparent;}
        .task-card:hover{background:rgba(0,255,153,.03);}
        .task-card.completed{opacity:.5;}
        .task-card.priority-high{border-left-color:#ff4d4d;}
        .task-card.priority-medium{border-left-color:#ffd700;}
        .task-card.priority-low{border-left-color:#00ff99;}

        /* Checkbox */
        .check-btn{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#00ff99;transition:.2s;flex-shrink:0;margin-top:2px;}
        .check-btn.checked{background:#00ff99;border-color:#00ff99;color:#020817;}
        .check-btn:hover{border-color:#00ff99;}

        /* Task body */
        .task-body{flex:1;min-width:0;}
        .task-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
        .task-title{font-size:15px;font-weight:500;}
        .completed .task-title{text-decoration:line-through;color:#8899bb;}
        .task-badges{display:flex;gap:6px;align-items:center;flex-shrink:0;}
        .priority-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 9px;border-radius:20px;text-transform:capitalize;font-weight:600;}
        .due-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;}
        .task-desc{font-size:13px;color:#8899bb;margin-top:6px;line-height:1.5;}

        /* Delete */
        .delete-btn{background:transparent;border:none;color:#4a5568;cursor:pointer;padding:5px;border-radius:7px;transition:.2s;flex-shrink:0;display:flex;align-items:center;}
        .delete-btn:hover{color:#ff4d4d;background:rgba(255,77,77,.1);}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;}
        .modal{background:#06102a;border:1px solid rgba(0,255,153,.15);border-radius:16px;width:480px;max-width:92%;max-height:90vh;overflow-y:auto;}
        .modal-header{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);}
        .modal-title{display:flex;align-items:center;gap:9px;}
        .modal-header h3{font-size:16px;font-weight:600;}
        .close-btn{background:none;border:none;color:#8899bb;cursor:pointer;display:flex;align-items:center;}
        .modal-body{padding:20px 22px;display:flex;flex-direction:column;gap:14px;}
        .form-group{display:flex;flex-direction:column;gap:6px;}
        .form-group label{display:flex;align-items:center;gap:5px;font-size:11px;color:#8899bb;text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
        .form-group input,.form-group textarea,.form-group select{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:white;padding:10px 12px;border-radius:9px;font-size:13px;transition:.2s;resize:none;font-family:'Inter',sans-serif;}
        .form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:rgba(0,255,153,.4);}
        .form-group select option{background:#081633;}
        .form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .modal-footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid rgba(255,255,255,.08);}
        .cancel-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#ccc;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;}
        .submit-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#00ff99,#00cc66);color:#020817;border:none;padding:9px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;transition:.2s;}
        .submit-btn:disabled{opacity:.6;cursor:not-allowed;}
        .spinner{width:14px;height:14px;border:2px solid rgba(2,8,23,.3);border-top-color:#020817;border-radius:50%;animation:spin .6s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:1100px){.task-stats{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:900px){
          .main{margin-left:0;padding:16px;}
          .task-stats{grid-template-columns:repeat(2,1fr);}
          .page-header{flex-direction:column;align-items:flex-start;gap:10px;}
          .task-top{flex-direction:column;align-items:flex-start;gap:6px;}
        }
      `}</style>
    </>
  );
}
