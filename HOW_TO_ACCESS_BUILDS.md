# 📦 How to Access Your Build Files

## 🎯 Quick Answer

### For **Development Builds** (pushed to main):
→ Download from **GitHub Actions Artifacts** (90-day retention)

### For **Release Builds** (pushed tags):
→ Download from **GitHub Releases** (permanent)

---

## 📥 Method 1: Download from GitHub Actions Artifacts

**When to use:** After any push to main branch (development builds)

### Steps:

1. **Go to Actions page:**
   ```
   https://github.com/YOUR_USERNAME/wichain/actions
   ```

2. **Click on the latest workflow run:**
   - Look for "Build WiChain for All Platforms"
   - Click on the most recent one
   - Check that all 3 jobs succeeded (✅ green checkmarks)

3. **Scroll down to "Artifacts" section:**
   You'll see three artifacts:
   - **wichain-windows** (~50-60 MB)
   - **wichain-linux** (~100-110 MB, contains 2 files)
   - **wichain-macos** (~50-60 MB)

4. **Download artifact:**
   - Click on artifact name
   - Browser downloads a `.zip` file
   - Extract the zip to get your installer

5. **File structure after extraction:**
   ```
   wichain-windows.zip
   └── wichain_1.0.1_x64_en-US.msi

   wichain-linux.zip
   ├── wichain_1.0.1_amd64.deb
   └── wichain_1.0.1_amd64.AppImage

   wichain-macos.zip
   └── wichain_1.0.1_x64.dmg
   ```

**Note:** Artifacts are automatically deleted after 90 days.

---

## 🎉 Method 2: Create a GitHub Release (RECOMMENDED)

**When to use:** For official releases that users can download

### Why Use Releases?

✅ **Permanent:** Files never expire  
✅ **Professional:** Dedicated release page with notes  
✅ **Discoverable:** Shows up in "Releases" section  
✅ **Versioned:** Clear version history  
✅ **Public:** Easy to share with users  

### How to Create a Release:

#### Step 1: Commit Your Code
```bash
cd f:\Major_Project\wichain

# Make sure all changes are committed
git add .
git commit -m "Release v1.0.1: Production ready"
git push origin main
```

#### Step 2: Create and Push a Tag
```bash
# Create a tag (use semantic versioning)
git tag v1.0.1

# Push the tag to GitHub
git push origin v1.0.1
```

#### Step 3: Wait for Build
- Go to: `https://github.com/YOUR_USERNAME/wichain/actions`
- Watch the workflow run (~40 minutes for all 3 platforms)
- **Both jobs will run this time:**
  - ✅ Build job (creates installers)
  - ✅ Release job (creates GitHub Release)

#### Step 4: Check Release Page
- Go to: `https://github.com/YOUR_USERNAME/wichain/releases`
- You'll see your new release: **v1.0.1**
- All installers are attached
- Release notes are auto-generated
- Users can download directly!

### Release Page Example:
```
🎉 WiChain v1.0.1

📦 Downloads
• wichain_v1.0.1_x64.msi (Windows)
• wichain_v1.0.1_amd64.deb (Linux)
• wichain_v1.0.1_amd64.AppImage (Linux)
• wichain_v1.0.1_x64.dmg (macOS)

🚀 Installation
[Step-by-step instructions...]

📝 What's New
[Changelog details...]
```

---

## 🔄 Workflow Comparison

### Development Workflow (Daily Work)
```bash
# Make changes
git add .
git commit -m "Fix bug"
git push origin main
```
**Result:** 
- ✅ Build job runs
- ❌ Release job skipped
- 📦 Artifacts available in Actions
- ⏰ Auto-deleted after 90 days

### Release Workflow (Official Release)
```bash
# Make changes
git add .
git commit -m "Release v1.0.1"
git push origin main

# Create tag
git tag v1.0.1
git push origin v1.0.1
```
**Result:**
- ✅ Build job runs
- ✅ Release job runs
- 🎉 GitHub Release created
- ♾️ Files stored permanently

---

## 📊 Understanding the Workflow

### Build Job (Always Runs)
```yaml
on:
  push:
    branches: [main]
  tags:
    - 'v*'
```
- Runs on every push to main
- Runs on every tag push
- Builds for Windows, macOS, Linux
- Uploads artifacts

### Release Job (Only on Tags)
```yaml
if: startsWith(github.ref, 'refs/tags/')
```
- **Only** runs when you push a tag
- Downloads artifacts from build job
- Creates GitHub Release
- Attaches installers
- Generates release notes

---

## 🎯 When to Use Which?

### Use **Artifacts** (Development):
- Testing builds locally
- Quick iteration
- Not ready for public release
- Internal testing
- Short-term storage needed

### Use **Releases** (Production):
- Official version release
- Public distribution
- Long-term storage
- Version milestones
- User downloads

---

## 📝 Common Questions

### Q: Why is the release job always skipped?
**A:** You're pushing to `main` branch, not pushing a tag. Release only triggers on tags.

### Q: How do I test builds before releasing?
**A:** 
1. Push to main
2. Download artifacts from Actions
3. Test locally
4. If good, create and push tag for release

### Q: Can I create a release manually?
**A:** Yes! 
1. Download artifacts from Actions
2. Go to: `https://github.com/YOUR_USERNAME/wichain/releases`
3. Click "Draft a new release"
4. Create a tag
5. Upload files manually
6. Publish

### Q: How do I delete a release?
**A:**
1. Go to Releases page
2. Click on the release
3. Click "Delete"
4. Delete the tag: `git push --delete origin v1.0.1`

### Q: Can I re-release the same version?
**A:**
```bash
# Force update the tag
git tag -f v1.0.1
git push -f origin v1.0.1
```
But better to use a new version (v1.0.2)

### Q: Artifacts expired. How do I get old builds?
**A:** You can't. This is why releases are important for official versions.

---

## 🚀 Best Practices

### Versioning Strategy

**Development:**
- Push to main frequently
- Test from artifacts
- No tags needed

**Pre-release:**
```bash
git tag v1.0.1-beta.1
git push origin v1.0.1-beta.1
```
- Creates a "pre-release"
- Marked as unstable
- Good for testing with users

**Official Release:**
```bash
git tag v1.0.1
git push origin v1.0.1
```
- Creates official release
- Marked as "latest"
- Users download this

### Version Numbering

Use [Semantic Versioning](https://semver.org/):
- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features)
- `v1.0.1` - Patch release (bug fixes)
- `v1.0.1-beta.1` - Pre-release

---

## 🔗 Quick Links

### Your Repository
- **Actions**: `https://github.com/YOUR_USERNAME/wichain/actions`
- **Releases**: `https://github.com/YOUR_USERNAME/wichain/releases`
- **Latest Release**: `https://github.com/YOUR_USERNAME/wichain/releases/latest`

### Download Artifacts
1. Actions → Click workflow run → Scroll to Artifacts

### Create Release
```bash
git tag v1.0.1 && git push origin v1.0.1
```

---

## 💡 Pro Tips

1. **Always test from artifacts before creating a release**
   ```bash
   # Test build
   git push origin main
   # Download from Actions, test
   # If OK, create release
   git tag v1.0.1 && git push origin v1.0.1
   ```

2. **Use descriptive commit messages before tagging**
   ```bash
   git commit -m "v1.0.1: Fix critical Linux dependency issue"
   git tag v1.0.1
   ```

3. **Update CHANGELOG.md before releasing**
   - Document what changed
   - Users will appreciate it

4. **Tag from main branch only**
   ```bash
   git checkout main
   git pull
   git tag v1.0.1
   git push origin v1.0.1
   ```

5. **Use annotated tags for important releases**
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1: Multi-platform support"
   git push origin v1.0.1
   ```

---

## 🎯 Summary

| Scenario | What to Do | Where to Get Files |
|----------|------------|-------------------|
| **Testing builds** | `git push origin main` | GitHub Actions → Artifacts |
| **Official release** | `git tag v1.0.1 && git push origin v1.0.1` | GitHub Releases |
| **Quick download** | Use latest successful Actions run | Artifacts section |
| **Permanent storage** | Create tagged release | Releases page |

---

**Need help?** Open an issue at `https://github.com/YOUR_USERNAME/wichain/issues`
