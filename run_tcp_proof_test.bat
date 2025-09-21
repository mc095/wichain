@echo off
echo ========================================
echo WiChain TCP/UDP Proof Test
echo For Evaluation Panel
echo ========================================
echo.

echo Starting TCP/UDP proof test...
echo This will monitor network connections and prove TCP functionality
echo.

python tcp_udp_proof_test.py > tcp_udp_test_results.txt 2>&1

echo.
echo Test completed! Results saved to: tcp_udp_test_results.txt
echo.
echo Opening results file...
notepad tcp_udp_test_results.txt

echo.
echo Press any key to exit...
pause > nul
