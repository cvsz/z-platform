package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const Version = "0.1.0"

type codedError struct{ code int; err error }
func (e codedError) Error() string { return e.err.Error() }
func ExitCode(err error) int { var e codedError; if errors.As(err,&e){ return e.code }; return 1 }

type options struct{ profile string; dryRun, json, verbose bool; timeout time.Duration }
type config struct{ compose, project, env, lock, audit string; allowPurge bool; healthTimeout time.Duration }
type runner struct{ dryRun, verbose bool; stderr io.Writer }
func (r runner) run(ctx context.Context, stdout io.Writer, name string, args ...string) error { if r.verbose||r.dryRun{fmt.Fprintf(r.stderr,"+ %s %s\n",name,strings.Join(args," "))}; if r.dryRun{return nil}; c:=exec.CommandContext(ctx,name,args...);c.Stdout=stdout;c.Stderr=r.stderr;c.Stdin=os.Stdin;return c.Run() }
func (r runner) output(ctx context.Context,name string,args ...string)([]byte,error){if r.verbose||r.dryRun{fmt.Fprintf(r.stderr,"+ %s %s\n",name,strings.Join(args," "))};if r.dryRun{return nil,nil};return exec.CommandContext(ctx,name,args...).Output()}

type application struct{ opts options; cfg config; run runner; stdout,stderr io.Writer }
type auditRecord struct{SchemaVersion string `json:"schemaVersion"`;OperationID string `json:"operationId"`;Command string `json:"command"`;Profile string `json:"profile"`;Actor string `json:"actor"`;StartedAt time.Time `json:"startedAt"`;CompletedAt time.Time `json:"completedAt"`;Result string `json:"result"`;Error string `json:"error,omitempty"`}

func Run(parent context.Context,args []string,stdout,stderr io.Writer) error{
	o,cmd,rest,err:=parse(args);if err!=nil{return codedError{2,err}}
	cfg,err:=defaults(o.profile);if err!=nil{return codedError{2,err}}
	a:=application{o,cfg,runner{o.dryRun,o.verbose,stderr},stdout,stderr}
	if cmd=="help"{a.help();return nil};if cmd=="version"{fmt.Fprintf(stdout,"zctl %s\n",Version);return nil}
	if !slices.Contains([]string{"start","stop","restart","status","health","logs","doctor"},cmd){return codedError{2,fmt.Errorf("unknown command %q",cmd)}}
	ctx,cancel:=context.WithTimeout(parent,o.timeout);defer cancel()
	rec:=auditRecord{SchemaVersion:"1.0.0",OperationID:id(),Command:cmd,Profile:o.profile,Actor:actor(),StartedAt:time.Now().UTC(),Result:"failed"}
	defer func(){rec.CompletedAt=time.Now().UTC();_ = a.audit(rec)}()
	if cmd=="doctor"{err=a.doctor(ctx)}else{if err=a.preflight(ctx);err==nil{switch cmd{case"start":err=a.locked(cmd,func()error{return a.start(ctx,rest)});case"stop":err=a.locked(cmd,func()error{return a.stop(ctx,rest)});case"restart":err=a.locked(cmd,func()error{return a.restart(ctx,rest)});case"status":err=a.compose(ctx,"ps");case"health":err=a.health(ctx,rest);case"logs":err=a.logs(ctx,rest)}}}
	if err==nil{rec.Result="success"}else{rec.Error=redact(err.Error())};return err
}

func defaults(profile string)(config,error){c:=config{compose:"compose.yml",project:"z-platform",lock:".zctl/operation.lock",audit:".zctl/audit",healthTimeout:180*time.Second};switch profile{case"local":c.env=".env";c.allowPurge=true;case"staging":c.env=".env.staging";case"production":c.env=".env.production";default:return c,fmt.Errorf("unknown profile %q",profile)};return c,nil}
func parse(args []string)(options,string,[]string,error){o:=options{profile:"local",timeout:3*time.Minute};cmd:="";rest:=[]string{};for i:=0;i<len(args);i++{v:=args[i];switch v{case"--profile","--timeout":if i+1>=len(args){return o,"",nil,fmt.Errorf("%s requires a value",v)};i++;if v=="--profile"{o.profile=args[i]}else{d,e:=time.ParseDuration(args[i]);if e!=nil{return o,"",nil,e};o.timeout=d};case"--dry-run":o.dryRun=true;case"--json":o.json=true;case"--verbose":o.verbose=true;default:if cmd==""&&!strings.HasPrefix(v,"-"){cmd=v}else{rest=append(rest,v)}}};if cmd==""{cmd="help"};return o,cmd,rest,nil}
func (a application) base()[]string{return []string{"compose","-f",a.cfg.compose,"--project-name",a.cfg.project,"--env-file",a.cfg.env}}
func (a application) compose(ctx context.Context,args ...string)error{return a.run.run(ctx,a.stdout,"docker",append(a.base(),args...)...)}
func (a application) output(ctx context.Context,args ...string)([]byte,error){return a.run.output(ctx,"docker",append(a.base(),args...)...)}
func (a application) preflight(ctx context.Context)error{if _,e:=exec.LookPath("docker");e!=nil{return codedError{3,errors.New("docker is unavailable")}};if !a.opts.dryRun{for _,p:=range []string{a.cfg.compose,a.cfg.env}{if _,e:=os.Stat(p);e!=nil{return codedError{2,fmt.Errorf("missing required file %s",p)}}}};if e:=a.compose(ctx,"config","--quiet");e!=nil{return codedError{2,fmt.Errorf("compose validation failed: %v",e)};return nil}
func splitServices(args []string)([]string,[]string,error){svc,flags:=[]string{},[]string{};for i:=0;i<len(args);i++{if args[i]=="--service"{if i+1>=len(args){return nil,nil,errors.New("--service requires a value")};i++;svc=append(svc,args[i])}else{flags=append(flags,args[i])}};return svc,flags,nil}
func (a application) validate(ctx context.Context,svc []string)error{if len(svc)==0{return nil};b,e:=a.output(ctx,"config","--services");if e!=nil{return e};allowed:=strings.Fields(string(b));for _,s:=range svc{if !slices.Contains(allowed,s){return codedError{2,fmt.Errorf("unknown service %q",s)}}};return nil}
func reject(flags []string,allowed ...string)error{for _,f:=range flags{if !slices.Contains(allowed,f){return fmt.Errorf("unknown flag %q",f)}};return nil}
func (a application) start(ctx context.Context,args []string)error{svc,f,e:=splitServices(args);if e!=nil{return codedError{2,e}};if e=reject(f,"--wait","--build");e!=nil{return codedError{2,e}};if e=a.validate(ctx,svc);e!=nil{return e};c:=[]string{"up","-d"};if slices.Contains(f,"--build"){c=append(c,"--build")};c=append(c,svc...);if e=a.compose(ctx,c...);e!=nil{return e};if slices.Contains(f,"--wait"){return a.wait(ctx,svc)};return a.compose(ctx,"ps")}
func (a application) stop(ctx context.Context,args []string)error{svc,f,e:=splitServices(args);if e!=nil{return codedError{2,e}};if e=reject(f,"--remove-orphans","--purge","--confirm-destroy");e!=nil{return codedError{2,e}};if e=a.validate(ctx,svc);e!=nil{return e};if slices.Contains(f,"--purge"){if !a.cfg.allowPurge{return codedError{4,errors.New("purge is forbidden for this profile")}};if !slices.Contains(f,"--confirm-destroy"){return codedError{4,errors.New("--purge requires --confirm-destroy")}};c:=[]string{"down","--volumes"};if slices.Contains(f,"--remove-orphans"){c=append(c,"--remove-orphans")};return a.compose(ctx,c...)};return a.compose(ctx,append([]string{"stop"},svc...)...)}
func (a application) restart(ctx context.Context,args []string)error{svc,f,e:=splitServices(args);if e!=nil{return codedError{2,e}};if e=reject(f,"--wait","--recreate");e!=nil{return codedError{2,e}};if e=a.validate(ctx,svc);e!=nil{return e};c:=[]string{"restart"};if slices.Contains(f,"--recreate"){c=[]string{"up","-d","--force-recreate"}};c=append(c,svc...);if e=a.compose(ctx,c...);e!=nil{return e};if slices.Contains(f,"--wait"){return a.wait(ctx,svc)};return a.compose(ctx,"ps")}
func (a application) logs(ctx context.Context,args []string)error{svc,f,e:=splitServices(args);if e!=nil{return codedError{2,e}};if e=a.validate(ctx,svc);e!=nil{return e};c:=[]string{"logs"};for i:=0;i<len(f);i++{if slices.Contains([]string{"--follow","-f","--timestamps"},f[i]){c=append(c,f[i]);continue};if f[i]=="--tail"&&i+1<len(f){c=append(c,f[i],f[i+1]);i++;continue};return codedError{2,fmt.Errorf("invalid logs flag %q",f[i])}};return a.compose(ctx,append(c,svc...)...)}
func (a application) health(ctx context.Context,args []string)error{if len(args)>1||(len(args)==1&&args[0]!="--wait"){return codedError{2,errors.New("health only accepts --wait")}};if len(args)==1{return a.wait(ctx,nil)};return a.healthOnce(ctx,nil)}
func (a application) healthOnce(ctx context.Context,svc []string)error{if len(svc)==0{b,e:=a.output(ctx,"config","--services");if e!=nil{return e};svc=strings.Fields(string(b))};b,e:=a.output(ctx,"ps","--status","running","--services");if e!=nil{return e};running:=strings.Fields(string(b));missing:=[]string{};for _,s:=range svc{if !slices.Contains(running,s){missing=append(missing,s)}};if a.opts.json{_ = json.NewEncoder(a.stdout).Encode(map[string]any{"healthy":len(missing)==0,"services":svc,"missing":missing})}else if len(missing)==0{fmt.Fprintln(a.stdout,"healthy: all requested services are running")}else{fmt.Fprintf(a.stdout,"unhealthy: %s\n",strings.Join(missing,", "))};if len(missing)>0{return errors.New("one or more services are not running")};return nil}
func (a application) wait(ctx context.Context,svc []string)error{deadline:=time.Now().Add(a.cfg.healthTimeout);for{e:=a.healthOnce(ctx,svc);if e==nil{return nil};if time.Now().After(deadline){return e};select{case<-ctx.Done():return ctx.Err();case<-time.After(2*time.Second):}}}
func (a application) doctor(ctx context.Context)error{checks:=map[string]string{};for _,d:=range []string{"docker","git"}{if _,e:=exec.LookPath(d);e==nil{checks[d]="ok"}else{checks[d]="missing"}};for k,p:=range map[string]string{"composeFile":a.cfg.compose,"environmentFile":a.cfg.env}{if _,e:=os.Stat(p);e==nil{checks[k]="ok"}else{checks[k]="missing"}};ok:=true;for _,v:=range checks{ok=ok&&v=="ok"};if a.opts.json{_ = json.NewEncoder(a.stdout).Encode(map[string]any{"healthy":ok,"checks":checks})}else{for _,k:=range []string{"docker","git","composeFile","environmentFile"}{fmt.Fprintf(a.stdout,"%-16s %s\n",k,checks[k])}};if !ok{return codedError{3,errors.New("doctor checks failed")};return nil}
func (a application) locked(op string,fn func()error)error{if a.opts.dryRun{return fn()};if e:=os.MkdirAll(filepath.Dir(a.cfg.lock),0o700);e!=nil{return e};f,e:=os.OpenFile(a.cfg.lock,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0o600);if e!=nil{return codedError{5,fmt.Errorf("operation conflict: %s",a.cfg.lock)}};_ = json.NewEncoder(f).Encode(map[string]any{"operation":op,"pid":os.Getpid(),"actor":actor(),"startedAt":time.Now().UTC()});_ = f.Close();defer os.Remove(a.cfg.lock);return fn()}
func (a application) audit(r auditRecord)error{if a.opts.dryRun{return nil};if e:=os.MkdirAll(a.cfg.audit,0o700);e!=nil{return e};p:=filepath.Join(a.cfg.audit,fmt.Sprintf("%s-%s-%s.json",r.StartedAt.Format("20060102T150405Z"),r.Command,r.OperationID));f,e:=os.OpenFile(p,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0o600);if e!=nil{return e};defer f.Close();enc:=json.NewEncoder(f);enc.SetIndent("","  ");return enc.Encode(r)}
func id()string{b:=make([]byte,8);_,_=rand.Read(b);return hex.EncodeToString(b)}
func actor()string{if u,e:=user.Current();e==nil{return u.Username};return "unknown"}
func redact(s string)string{l:=strings.ToLower(s);for _,m:=range []string{"token=","password=","api_key=","authorization:"}{if i:=strings.Index(l,m);i>=0{return s[:i]+m+"[REDACTED]"}};return s}
func (a application) help(){fmt.Fprintln(a.stdout,"zctl [global flags] <start|stop|restart|status|health|logs|doctor|version>")}
