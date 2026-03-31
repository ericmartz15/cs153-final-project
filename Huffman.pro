###############################################################################
# Project file for CS106B/X student program
#
# @version Winter Quarter 2025.2 for Qt 6
# @author Julie Zelenski
#   build client program using installed static library
###############################################################################

SPL_VERSION = 2025.2
SPL_URL = https://web.stanford.edu/dept/cs_edu/qt

TEMPLATE    =   app
QT          +=  core gui widgets network multimedia
CONFIG      +=  silent debug         # quiet build and debug symbols always
CONFIG      -=  depend_includepath   # library headers not changing, don't add depend

###############################################################################
#       Find/use installed version of cs106 lib and headers                   #
###############################################################################

# Library installed into per-user writable data location from QtStandardPaths
win32|win64     { QTP_EXE = qtpaths.exe } else { QTP_EXE = qtpaths }
USER_DATA_DIR   =   $$system($$[QT_INSTALL_BINS]/$$QTP_EXE --writable-path GenericDataLocation)

SPL_DIR         =   $${USER_DATA_DIR}/cs106
STATIC_LIB      =   $$system_path($${SPL_DIR}/lib/libcs106.a)
VERSION_FILE =      $$system_path($${SPL_DIR}/lib/spl_version)

# link against libcs106.a, add library headers to search path
# libcs106 requires libpthread, add link here
LIBS            +=  -lcs106 -lpthread
QMAKE_LFLAGS    =   -L$$shell_quote($${SPL_DIR}/lib)
# put PWD first in search list to allow local copy to shadow if needed
INCLUDEPATH     +=  $$PWD "$${SPL_DIR}/include"

###############################################################################
#       Configure project with custom settings                                #
###############################################################################

# changes to headers require recompilation
DEPENDPATH += $$PWD

# remove spaces from target executable for better Windows compatibility
TARGET      =   $$replace(TARGET, " ", _)

# set DESTDIR to project root dir, this is where executable/app will deploy and run
DESTDIR     =   $$PWD

# student writes ordinary main() function, but it must be called within a
# wrapper main() that handles library setup/teardown. Rename student's
# to distinguish between the two main() functions and avoid symbol clash
# Ask Julie if you are curious why main->qMain->studentMain
DEFINES     +=  main=qMain qMain=studentMain

###############################################################################
#       Gather files to list in Qt Creator project browser                    #
###############################################################################

# honeypot to trick Qt Creator to allow glob-all to coexist with user-added files
# Qt looks for first 'SOURCES *=' line and lists user-added .cpp/h files there.
# Afterward we glob-add files to SOURCES ourselves. Operator *= will unique
# entries, so no worries about duplicates
SOURCES         *=  ""
HEADERS         *=  ""

# Gather any .cpp or .h files within the project folder (student/starter code).
# Second argument true makes search recursive
SOURCES         *=  $$files(*.cpp, true)
HEADERS         *=  $$files(*.h, true)

# Gather resource files (image/sound/etc) from res dir, list under "Other files"
OTHER_FILES     *=  $$files(res/*, true)
# Gather text files from root dir or anywhere recursively
OTHER_FILES     *=  $$files(*.txt, true)

###############################################################################
#       Configure compiler, compile flags                                     #
###############################################################################

# Configure flags for the C++ compiler
# (In general, many warnings/errors are enabled to tighten compile-time checking.
# A few overly pedantic/confusing errors are turned off to avoid confusion.)

CONFIG          +=  sdk_no_version_check   # removes spurious warnings on Mac OS X

# MinGW compiler lags, be conservative and use C++11 on all platforms
# rather than special case
CONFIG          +=  c++11

# WARN_ON has -Wall -Wextra, add/remove a few specific warnings
QMAKE_CXXFLAGS_WARN_ON      +=  -Werror=return-type
QMAKE_CXXFLAGS_WARN_ON      +=  -Werror=uninitialized
QMAKE_CXXFLAGS_WARN_ON      +=  -Wunused-parameter
QMAKE_CXXFLAGS_WARN_ON      +=  -Wmissing-field-initializers
QMAKE_CXXFLAGS_WARN_ON      +=  -Wno-old-style-cast
QMAKE_CXXFLAGS_WARN_ON      +=  -Wno-sign-compare
QMAKE_CXXFLAGS_WARN_ON      +=  -Wno-sign-conversion
QMAKE_CXXFLAGS_WARN_ON      +=  -Wno-unused-const-variable

*-clang { # warning flags specific to clang
    QMAKE_CXXFLAGS_WARN_ON  +=  -Wempty-init-stmt
    QMAKE_CXXFLAGS_WARN_ON  +=  -Wignored-qualifiers
    QMAKE_CXXFLAGS_WARN_ON  +=  -Wno-implicit-function-declaration  # Qt 6.10 qyieldcpu.h/__yield on ARM
}

*-g++ {   # warning flags specific to g++
    QMAKE_CXXFLAGS_WARN_ON  +=  -Wlogical-op
}

###############################################################################
#       Detect/report errors in project structure                             #
###############################################################################

# error if project opened from within a ZIP archive (common mistake on Windows)
win32|win64 {
    contains(PWD, .*\.zip.*) | contains(PWD, .*\.ZIP.*) {
        warning( "*** You are trying to open this project from within a ZIP archive." )
        warning( "*** You must first extract the files then open in Qt Creator." )
        warning( "*** In File Explorer open the ZIP and choose to Extract All." )
        error( Exiting. Extract project from ZIP first.)
    }
}

# error if name of directory has chars that may cause trouble for qmake/make/shell
PROJECT_DIR = $$basename(PWD)
FOUND  = $$PROJECT_DIR
FOUND ~= s|[a-z A-Z 0-9 _.+-]||   # yes, spaces ok, limited punctuation, $ % & are dicey
!isEmpty(FOUND) {
    warning( "*** The name of your project directory contains the disallowed characters: $$FOUND" )
    warning( "*** The allowed characters are letters, numbers, and simple punctuation." )
    warning( "*** Please rename to a simple name such as Assignment_1 that contains no disallowed characters." )
    error(Exiting. Rename project directory to remove disallowed characters. )
}


!isEmpty(CURRENTLY_INSTALLING_LIBRARY) { # special case for Welcome app in CS106 package
    message( "Installing cs106 package, will skip library version check" )
} else {
    !exists($$STATIC_LIB) {             # confirm static lib exists
        warning( " *** No CS106 library found. Need to install." )
        error(Exiting. Install CS106 package following instructions at $$SPL_URL)
    }
    !exists($$VERSION_FILE) {           # confirm version file exists
         warning( " *** Cannot determine version of installed library. Need to re-install." )
         error(Exiting. Install CS106 package following instructions at $$SPL_URL)
    }
    CONTENTS = $$cat($$VERSION_FILE)    # confirm version file contents match this .pro file
    !equals(CONTENTS, $$SPL_VERSION) {
        warning( "*** Installed library version $$CONTENTS, expected $$SPL_VERSION" )
        error(Exiting. Install CS106 package following instructions at $$SPL_URL)
    }
}

###############################################################################
# ==== Auto-commit integration (build + run) ====
###############################################################################

# Paths to your scripts
SCRIPT_UNIX = $$PWD/auto_commit.sh
SCRIPT_WIN  = $$system_path($$PWD/auto_commit.ps1)

# If DESTDIR isn't set elsewhere, use the build output dir
isEmpty(DESTDIR): DESTDIR = $$OUT_PWD

# Compute the built executable path (for --run)
macx {
    APP_EXE = $$DESTDIR/$$TARGET.app/Contents/MacOS/$$TARGET
} else:win32 {
    APP_EXE = $$system_path($$DESTDIR/$$TARGET.exe)
} else {
    APP_EXE = $$DESTDIR/$$TARGET
}

# Make sure the UNIX script is executable
!win32 {
    prepare_script.target = prepare_script
    prepare_script.commands = chmod +x \"$$SCRIPT_UNIX\"
    QMAKE_EXTRA_TARGETS += prepare_script
}

# --- Build hook: commit after successful link (no launch) ---
# Runs every time the target is (re)linked.
# Pass: [REPO_ROOT] [TARGET_NAME] [DESTDIR]
!win32 {
    QMAKE_POST_LINK += \"$$SCRIPT_UNIX\" --build-hook \"$$PWD\" \"$$TARGET\" \"$$DESTDIR\" || true
}
win32 {
    # Use PowerShell; don't fail the link step if the script fails
    QMAKE_POST_LINK += powershell -NoProfile -ExecutionPolicy Bypass -File \"$$SCRIPT_WIN\" --build-hook \"$$system_path($$PWD)\" \"$$TARGET\" \"$$system_path($$DESTDIR)\" || ver > nul
}

# --- Run hook: shareable make target that launches via the script ---
# Students can run: 1) Build → "Run qmake target…" → run_custom, or
# 2) from terminal: `make run_custom` / `nmake run_custom` / `mingw32-make run_custom`
run_custom.target  = run_custom
run_custom.depends = all
!win32: run_custom.depends += prepare_script
!win32: run_custom.commands = \"$$SCRIPT_UNIX\" --run --exe \"$$APP_EXE\" \"$$PWD\" \"$$TARGET\" \"$$DESTDIR\"
win32:  run_custom.commands = powershell -NoProfile -ExecutionPolicy Bypass -File \"$$SCRIPT_WIN\" --run --exe \"$$APP_EXE\" \"$$system_path($$PWD)\" \"$$TARGET\" \"$$system_path($$DESTDIR)\"

QMAKE_EXTRA_TARGETS += run_custom

# (Optional) Mark the main app as runnable in Qt Creator’s UI
CONFIG += qtc_runnable
