examples=(
  "dex"
  "oracle"
  "erc20"
  "state-rent"
  "e2e"
  "scheduler"
  "arbitrager"
  "uniswap"
)

root=$(pwd)

for e in "${examples[@]}"
do
  echo "--------------- testing ${e} ---------------"

  cd  "${root}/${e}"
  rushx test

  echo ""
done