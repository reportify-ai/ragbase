use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::path::PathBuf;
use anyhow::Result;

pub struct ProcessManager {
    pub next_process: Arc<Mutex<Option<Child>>>,
    pub tasks_process: Arc<Mutex<Option<Child>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            next_process: Arc::new(Mutex::new(None)),
            tasks_process: Arc::new(Mutex::new(None)),
        }
    }

    /// Get the data directory path
    pub fn get_data_dir() -> String {
        let is_dev = Self::is_dev();
        
        if is_dev {
            // In development, use project root data directory
            let project_root = Self::get_project_root();
            let data_dir = project_root.join("data");
            return data_dir.to_string_lossy().to_string();
        } else {
            // In production, use user home directory
            if let Ok(home) = std::env::var("HOME") {
                let data_dir = format!("{}/.ragbase", home);
                // Ensure the directory exists
                if let Err(e) = std::fs::create_dir_all(&data_dir) {
                    eprintln!("[tauri/process] Failed to create data directory {}: {}", data_dir, e);
                } else {
                    println!("[tauri/process] Data directory created/verified: {}", data_dir);
                }
                return data_dir;
            } else {
                "./data".to_string()
            }
        }
    }

    /// Get the project root directory
    fn get_project_root() -> PathBuf {
        let is_dev = Self::is_dev();
        
        if is_dev {
            // In development, use current directory
            let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            if current_dir.ends_with("src-tauri") {
                current_dir.parent().unwrap().to_path_buf()
            } else {
                current_dir
            }
        } else {
            // In production, use the app bundle Resources directory
            if let Some(exe_path) = std::env::current_exe().ok() {
                if let Some(app_dir) = exe_path.parent() {
                    // For macOS app bundle, go up to Contents/Resources
                    if app_dir.ends_with("MacOS") {
                        if let Some(contents_dir) = app_dir.parent() {
                            let resources_dir = contents_dir.join("Resources");
                            return resources_dir.to_path_buf();
                        }
                    }
                    // For other cases, use the executable directory
                    return app_dir.to_path_buf();
                }
            }
            // Fallback to current directory
            std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
        }
    }

    /// Check if we're in development mode
    pub fn is_dev() -> bool {
        let rust_env = std::env::var("RUST_ENV").unwrap_or_default();
        let debug_assertions = cfg!(debug_assertions);
        let is_dev = rust_env == "development" || debug_assertions;
        
        is_dev
    }

    /// Run database migration
    pub fn run_database_migration(&self) -> Result<()> {
        let is_dev = Self::is_dev();
        let project_root = Self::get_project_root();
        let data_dir = Self::get_data_dir();
        
        println!("[tauri/process] Running database migration...");
        println!("[tauri/process] Project root: {:?}", project_root);
        println!("[tauri/process] Is dev: {}", is_dev);
        
        // Determine migration file path
        let migration_path = if is_dev {
            project_root.join("dist").join("db").join("migrate.js")
        } else {
            // In production, migration should be bundled
            project_root.join("dist").join("db").join("migrate.js")
        };
        
        // Determine working directory
        let cwd = project_root;
        
        println!("[tauri/process] Migration path: {:?}", migration_path);
        println!("[tauri/process] CWD: {:?}", cwd);
        
        // Run migration process
        let mut cmd = Command::new("node");
        cmd.arg(migration_path)
            .current_dir(cwd)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .env("DATA_DIR", &data_dir);
        
        // Add additional environment variables
        if is_dev {
            cmd.env("NODE_ENV", "development");
        } else {
            cmd.env("NODE_ENV", "production");
        }
        
        let result = cmd.output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    println!("[tauri/process] Database migration completed successfully");
                    Ok(())
                } else {
                    let error_msg = String::from_utf8_lossy(&output.stderr);
                    eprintln!("[tauri/process] Database migration failed: {}", error_msg);
                    Err(anyhow::anyhow!("Migration failed with code {}", output.status))
                }
            }
            Err(e) => {
                eprintln!("[tauri/process] Failed to run database migration: {}", e);
                Err(anyhow::anyhow!("Failed to run migration: {}", e))
            }
        }
    }

    /// Start Next.js development server
    pub fn start_next_server(&self) -> Result<()> {
        let next_process = Arc::clone(&self.next_process);
        
        thread::spawn(move || {
            let is_dev = Self::is_dev();
            let project_root = Self::get_project_root();
            let data_dir = Self::get_data_dir();
            
            println!("[tauri/process] Starting Next.js server...");
            println!("[tauri/process] Project root: {:?}", project_root);
            println!("[tauri/process] Is dev: {}", is_dev);
            
            // Determine Next.js binary path
            let next_path = if is_dev {
                project_root.join("node_modules").join("next").join("dist").join("bin").join("next")
            } else {
                // In production, Next.js should be bundled with the app
                project_root.join("node_modules").join("next").join("dist").join("bin").join("next")
            };
            
            // Determine arguments
            let args = if is_dev {
                vec!["dev", "--turbopack"]
            } else {
                vec!["start"]
            };
            
            // Determine working directory
            let cwd = project_root;
            
            println!("[tauri/process] Next.js path: {:?}", next_path);
            println!("[tauri/process] Args: {:?}", args);
            println!("[tauri/process] CWD: {:?}", cwd);
            
            // Start Next.js process
            let mut cmd = Command::new("node");
            cmd.arg(next_path)
                .args(args)
                .current_dir(cwd)
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .env("DATA_DIR", data_dir);
            
            // Add additional environment variables for development
            if is_dev {
                cmd.env("NODE_ENV", "development");
            } else {
                cmd.env("NODE_ENV", "production");
            }
            
            let result = cmd.spawn();

            match result {
                Ok(child) => {
                    println!("[tauri/process] Next.js server started successfully");
                    let mut guard = next_process.lock().unwrap();
                    *guard = Some(child);
                }
                Err(e) => {
                    eprintln!("[tauri/process] Failed to start Next.js server: {}", e);
                }
            }
        });

        Ok(())
    }

    /// Start background tasks process
    pub fn start_background_tasks(&self) -> Result<()> {
        let tasks_process = Arc::clone(&self.tasks_process);
        
        thread::spawn(move || {
            let is_dev = Self::is_dev();
            let project_root = Self::get_project_root();
            let data_dir = Self::get_data_dir();
            
            println!("[tauri/process] Starting background tasks...");
            println!("[tauri/process] Project root: {:?}", project_root);
            println!("[tauri/process] Is dev: {}", is_dev);
            
            // Determine tasks file path
            let tasks_path = if is_dev {
                project_root.join("dist").join("app").join("tasks.js")
            } else {
                // In production, tasks should be bundled
                project_root.join("dist").join("app").join("tasks.js")
            };
            
            // Determine working directory
            let cwd = project_root;
            
            println!("[tauri/process] Tasks path: {:?}", tasks_path);
            println!("[tauri/process] CWD: {:?}", cwd);
            
            // Start tasks process
            let mut cmd = Command::new("node");
            cmd.arg(tasks_path)
                .current_dir(cwd)
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .env("DATA_DIR", &data_dir)
                .env("RUST_LOG", "info;lancedb=info");
            
            // Add additional environment variables
            if is_dev {
                cmd.env("NODE_ENV", "development");
            } else {
                cmd.env("NODE_ENV", "production");
            }
            
            let result = cmd.spawn();

            match result {
                Ok(child) => {
                    println!("[tauri/process] Background tasks started successfully");
                    println!("[tauri/process] Data directory: {}", data_dir);
                    let mut guard = tasks_process.lock().unwrap();
                    *guard = Some(child);
                }
                Err(e) => {
                    eprintln!("[tauri/process] Failed to start background tasks: {}", e);
                }
            }
        });

        Ok(())
    }

    /// Stop all processes
    pub fn stop_all_processes(&self) {
        println!("[tauri/process] Stopping all processes...");
        
        // Stop Next.js process
        if let Ok(mut guard) = self.next_process.lock() {
            if let Some(mut child) = guard.take() {
                println!("[tauri/process] Stopping Next.js process (PID: {})...", child.id());
                
                // Try graceful shutdown first
                let _ = child.kill();
                
                // Wait a bit for graceful shutdown
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                // Force kill if still running
                if let Ok(Some(_)) = child.try_wait() {
                    println!("[tauri/process] Next.js process stopped gracefully");
                } else {
                    println!("[tauri/process] Force killing Next.js process tree...");
                    // Force kill the entire process tree
                    let _ = Command::new("pkill")
                        .args(&["-P", &child.id().to_string()])
                        .output();
                    let _ = child.kill();
                }
            }
        }

        // Stop background tasks process
        if let Ok(mut guard) = self.tasks_process.lock() {
            if let Some(mut child) = guard.take() {
                println!("[tauri/process] Stopping background tasks process (PID: {})...", child.id());
                
                // Try graceful shutdown first
                let _ = child.kill();
                
                // Wait a bit for graceful shutdown
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                // Force kill if still running
                if let Ok(Some(_)) = child.try_wait() {
                    println!("[tauri/process] Background tasks process stopped gracefully");
                } else {
                    println!("[tauri/process] Force killing background tasks process tree...");
                    // Force kill the entire process tree
                    let _ = Command::new("pkill")
                        .args(&["-P", &child.id().to_string()])
                        .output();
                    let _ = child.kill();
                }
            }
        }
        
        // Additional cleanup: kill any remaining node processes that might be related
        println!("[tauri/process] Cleaning up any remaining related processes...");
        let _ = Command::new("pkill")
            .args(&["-f", "next dev"])
            .output();
        let _ = Command::new("pkill")
            .args(&["-f", "tasks.js"])
            .output();
        
        println!("[tauri/process] All processes stopped");
    }

    /// Check if processes are still running
    pub fn check_processes_health(&self) -> (bool, bool) {
        let next_running = if let Ok(guard) = self.next_process.lock() {
            if let Some(child) = guard.as_ref() {
                child.id() > 0
            } else {
                false
            }
        } else {
            false
        };

        let tasks_running = if let Ok(guard) = self.tasks_process.lock() {
            if let Some(child) = guard.as_ref() {
                child.id() > 0
            } else {
                false
            }
        } else {
            false
        };

        (next_running, tasks_running)
    }

    /// Check if port is available
    pub fn is_port_available(port: u16) -> bool {
        use std::net::TcpListener;
        TcpListener::bind(format!("0.0.0.0:{}", port)).is_ok()
    }

    /// Wait for port to become available (server to start)
    pub fn wait_for_port(port: u16, timeout_seconds: u64) -> bool {
        use std::time::Instant;
        let start = Instant::now();
        let timeout = std::time::Duration::from_secs(timeout_seconds);
        
        while start.elapsed() < timeout {
            if !Self::is_port_available(port) {
                println!("[tauri/process] Port {} is now in use (server started)", port);
                return true;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        
        println!("[tauri/process] Timeout waiting for port {} to become available", port);
        false
    }
}
