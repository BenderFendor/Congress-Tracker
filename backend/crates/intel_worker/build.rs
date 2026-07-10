fn main() {
    println!("cargo:rerun-if-changed=../intel_backend/migrations");
}
